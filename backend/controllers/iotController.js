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
    const logs = await Log.find().sort({ timestamp: -1 }).limit(100).lean();
    const waterings = await WateringEvent.find().sort({ timestamp: -1 }).limit(20).lean();

    if (logs.length < 10) {
      return res.json({
        prediction: "Not enough data yet",
        confidence: "low",
        hoursUntil: null,
        reason: "Insufficient historical data"
      });
    }

    
    const sortedLogs = logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    
    let totalSoil = 0;
    let dryingRateSum = 0;
    let count = 0;

    for (let i = 1; i < sortedLogs.length; i++) {
      const prev = sortedLogs[i - 1];
      const curr = sortedLogs[i];

      const avgSoilPrev = (prev.sensors.soil1 + prev.sensors.soil2) / 2;
      const avgSoilCurr = (curr.sensors.soil1 + curr.sensors.soil2) / 2;
      const timeDiffHours = (new Date(curr.timestamp) - new Date(prev.timestamp)) / (1000 * 60 * 60);

      if (timeDiffHours > 0 && timeDiffHours < 12) { // reasonable interval
        totalSoil += avgSoilCurr;
        dryingRateSum += (avgSoilPrev - avgSoilCurr) / timeDiffHours; // moisture loss per hour
        count++;
      }
    }

    const avgSoilMoisture = totalSoil / count || 2000;
    const avgDryingRate = dryingRateSum / count || 50; // moisture units per hour

    const soilThreshold = 2500; // when we usually water

    let hoursUntilWatering = Math.max(1, Math.round((avgSoilMoisture - soilThreshold) / avgDryingRate));

    // Adjust based on recent watering and temperature
    const lastWatering = waterings[0];
    const recentTemp = sortedLogs[sortedLogs.length - 1]?.sensors.temperature || 25;

    if (recentTemp > 30) hoursUntilWatering = Math.round(hoursUntilWatering * 0.7); // hotter = faster drying
    if (lastWatering && (Date.now() - new Date(lastWatering.timestamp)) < 12 * 60 * 60 * 1000) {
      hoursUntilWatering = Math.max(8, hoursUntilWatering); // don't water too soon after last
    }

    const predictedTime = new Date(Date.now() + hoursUntilWatering * 60 * 60 * 1000);

    res.json({
      prediction: predictedTime.toLocaleString(),
      hoursUntil: hoursUntilWatering,
      confidence: hoursUntilWatering > 48 ? "medium" : "high",
      currentAvgSoil: Math.round(avgSoilMoisture),
      avgDryingRate: Math.round(avgDryingRate),
      reason: `Based on current moisture (${Math.round(avgSoilMoisture)}) and drying rate (${Math.round(avgDryingRate)}/hour)`
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
