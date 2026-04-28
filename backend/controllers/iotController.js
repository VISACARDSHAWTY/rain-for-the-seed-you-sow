const Log = require("../models/Log");
const { publishControl, getLastTelemetry, onTelemetry } = require("../src/mqttClient");

const VALID_ACTUATORS = new Set(["pump", "fan", "buzzer"]);
const AUTO_TOGGLE_ACTUATORS = new Set(["pump", "fan"]);

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

exports.startWaterZone = (req, res) => {
  try {
    const zone = Number(req.params.zone);
    if (zone !== 1 && zone !== 2) {
      return res.status(400).json({ error: "Zone must be 1 or 2" });
    }

    const command = `water_zone_${zone}`;
    const published = publishControl(command);
    return res.json({ ok: true, command, published });
  } catch (err) {
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

// Optional: simple Server-Sent Events endpoint (kept here for easy wiring later)
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

