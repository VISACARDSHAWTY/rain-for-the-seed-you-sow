const Log = require("../models/Log");
const WateringEvent = require("../models/WateringEvent");
const { publishControl, getLastTelemetry, onTelemetry } = require("../src/mqttClient");

const VALID_ACTUATORS = new Set(["pump", "fan", "buzzer"]);
const AUTO_TOGGLE_ACTUATORS = new Set(["pump", "fan", "tent"]);

// Get latest state (unchanged)
exports.getLatestState = async (req, res) => {
  try {
    const memory = getLastTelemetry();
    if (memory) return res.json({ source: "memory", state: memory });

    const latest = await Log.findOne().sort({ timestamp: -1 }).lean();
    if (!latest) return res.json({ source: "none", state: null });

    return res.json({ source: "db", state: latest });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Record watering event when zone is started
exports.startWaterZone = async (req, res) => {
  try {
    const zone = Number(req.params.zone);
    if (zone !== 1 && zone !== 2) {
      return res.status(400).json({ error: "Zone must be 1 or 2" });
    }

    const currentTelemetry = getLastTelemetry();
    const sensorsBefore = currentTelemetry?.sensors || {};

    // Create watering event
    await WateringEvent.create({
      zone,
      trigger: "manual",           // for now all from web are manual
      sensorsBefore: {
        soil1: sensorsBefore.soil1,
        soil2: sensorsBefore.soil2,
        waterLevel: sensorsBefore.waterLevel
      }
    });

    const command = `water_zone_${zone}`;
    const published = publishControl(command);

    return res.json({ 
      ok: true, 
      command, 
      published,
      message: `Watering Zone ${zone} started and logged`
    });
  } catch (err) {
    console.error("Error logging watering event:", err);
    return res.status(500).json({ error: err.message });
  }
};

exports.stopWaterZone = (req, res) => {
  try {
    const command = "water_stop";
    const published = publishControl(command);
    return res.json({ ok: true, command, published });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.setActuatorState = (req, res, { state }) => {
  try {
    const name = String(req.params.name || "").toLowerCase();
    if (!VALID_ACTUATORS.has(name)) {
      return res.status(400).json({ error: `Unknown actuator: ${name}` });
    }
    if (state !== "on" && state !== "off") {
      return res.status(400).json({ error: "Invalid state" });
    }

    const command = `${name}_${state}`;
    const published = publishControl(command);
    return res.json({ ok: true, command, published });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.setAutoMode = (req, res, { state }) => {
  try {
    const command = state === "on" ? "auto_on" : "auto_off";
    const published = publishControl(command);
    return res.json({ ok: true, command, published });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.setTentState = (req, res, { state }) => {
  try {
    if (state !== "open" && state !== "close") {
      return res.status(400).json({ error: "Invalid tent state" });
    }
    const command = state === "open" ? "tent_open" : "tent_close";
    const published = publishControl(command);
    return res.json({ ok: true, command, published });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.setActuatorAuto = (req, res, { state }) => {
  try {
    const name = String(req.params.name || "").toLowerCase();
    if (!AUTO_TOGGLE_ACTUATORS.has(name)) {
      return res.status(400).json({ error: `Auto toggle not supported for actuator: ${name}` });
    }
    if (state !== "on" && state !== "off") {
      return res.status(400).json({ error: "Invalid state" });
    }

    const command = `${name}_auto_${state}`;
    const published = publishControl(command);
    return res.json({ ok: true, command, published });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getWateringHistory = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const events = await WateringEvent.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSensorLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await Log.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.setThreshold = (req, res) => {
  try {
    const { type } = req.params;        // tempThreshold, soilThreshold, lightThreshold
    const value = parseInt(req.params.value);

    if (!["tempThreshold", "soilThreshold", "lightThreshold"].includes(type)) {
      return res.status(400).json({ error: "Invalid threshold type" });
    }

    if (isNaN(value)) {
      return res.status(400).json({ error: "Invalid value" });
    }

    let command = "";

    switch (type) {
      case "tempThreshold":
        command = `temp_threshold_${value}`;
        break;
      case "soilThreshold":
        command = `soil_threshold_${value}`;
        break;
      case "lightThreshold":
        command = `light_threshold_${value}`;
        break;
    }

    const published = publishControl(command);

    return res.json({
      ok: true,
      command,
      published,
      message: `${type} updated to ${value}`
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.attachSse = (app) => {
  const clients = new Set();

  app.get("/api/iot/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const initial = getLastTelemetry();
    if (initial) send({ type: "telemetry", data: initial });

    clients.add(send);

    req.on("close", () => {
      clients.delete(send);
    });
  });

  onTelemetry((telemetry) => {
    for (const send of clients) send({ type: "telemetry", data: telemetry });
  });
};




exports.predictNextWatering = async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: 1 }).lean();
    const waterings = await WateringEvent.find().sort({ timestamp: 1 }).lean();

    if (logs.length < 20 || waterings.length < 2) {
      return res.json({
        prediction: "Not enough data",
        confidence: "low",
        hoursUntil: null,
        reason: "Need more cycles"
      });
    }

    const SOIL_THRESHOLD = 2350;

    
    let cycles = [];

    for (let i = 0; i < waterings.length; i++) {
      const start = waterings[i];
      const end = waterings[i + 1];

      const startTime = new Date(start.timestamp);
      const endTime = end
        ? new Date(end.timestamp)
        : new Date(logs[logs.length - 1].timestamp);

      const cycleLogs = logs.filter(l =>
        new Date(l.timestamp) >= startTime &&
        new Date(l.timestamp) <= endTime
      );

      if (cycleLogs.length < 5) continue;

      const first = cycleLogs[0];
      const last = cycleLogs[cycleLogs.length - 1];

      const startSoil =
        (first.sensors.soil1 + first.sensors.soil2) / 2;

      const endSoil =
        (last.sensors.soil1 + last.sensors.soil2) / 2;

      const hours =
        (new Date(last.timestamp) - new Date(first.timestamp)) /
        (1000 * 60 * 60);

      if (hours <= 0) continue;

      cycles.push({
        rate: (endSoil - startSoil) / hours,
        duration: hours,
        startSoil,
        endSoil
      });
    }

    if (cycles.length < 3) {
      return res.json({
        prediction: "Not enough cycles",
        confidence: "low"
      });
    }
    const rates = cycles.map(c => c.rate).filter(r => r > 0);

    rates.sort((a, b) => a - b);
    const medianRate = rates[Math.floor(rates.length / 2)];

    
    const latestLogs = logs.slice(-10);

    const currentSoil =
      latestLogs.reduce((sum, l) =>
        sum + (l.sensors.soil1 + l.sensors.soil2) / 2, 0
      ) / latestLogs.length;

    const lastWatering = waterings[waterings.length - 1];
    const lastWateringTime = new Date(lastWatering.timestamp);

    const hoursSinceWatering =
      (Date.now() - lastWateringTime) / (1000 * 60 * 60);

    
    const soilToDry =
      currentSoil >= SOIL_THRESHOLD
        ? 0
        : SOIL_THRESHOLD - currentSoil;

    const hoursUntil =
      medianRate > 0
        ? Math.max(1, soilToDry / medianRate)
        : 12;

    
    const recentTemp =
      latestLogs[latestLogs.length - 1]?.sensors.temperature || 25;

    let adjustedHours = hoursUntil;

    if (recentTemp > 30) adjustedHours *= 0.85;
    if (recentTemp < 18) adjustedHours *= 1.1;

    
    const predictedTime = new Date(
      Date.now() + adjustedHours * 60 * 60 * 1000
    );

    res.json({
      prediction: predictedTime.toLocaleString(),
      hoursUntil: Math.round(adjustedHours),
      confidence: cycles.length > 10 ? "high" : "medium",
      currentSoil: Math.round(currentSoil),
      medianDryingRate: Math.round(medianRate),
      cyclesUsed: cycles.length
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};