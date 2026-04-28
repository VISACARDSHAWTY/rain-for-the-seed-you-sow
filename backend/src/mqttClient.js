const mongoose = require("mongoose");
const mqtt = require("mqtt");
const { EventEmitter } = require("events");
const Log = require("../models/Log");

const telemetryEvents = new EventEmitter();

let mqttClient = null;
let lastTelemetry = null;

const MQTT_URL = process.env.MQTT_URL || "mqtt://10.52.170.186:1883";
const MQTT_DATA_TOPIC = process.env.MQTT_DATA_TOPIC || "smartplant/data";
const MQTT_CONTROL_TOPIC = process.env.MQTT_CONTROL_TOPIC || "smartplant/control";

const initMqttClient = () => {
  if (mqttClient) return mqttClient;

  mqttClient = mqtt.connect(MQTT_URL);

  mqttClient.on("connect", () => {
    console.log("✓ MQTT connected:", MQTT_URL);
    mqttClient.subscribe(MQTT_DATA_TOPIC, (err) => {
      if (err) console.log("✗ Subscribe error:", err.message);
      else console.log(`✓ Subscribed to ${MQTT_DATA_TOPIC}`);
    });
  });

  mqttClient.on("reconnect", () => {
    console.log("… MQTT reconnecting");
  });

  mqttClient.on("error", (err) => {
    console.log("✗ MQTT Error:", err.message);
  });

  mqttClient.on("close", () => {
    console.log("✗ MQTT connection closed");
  });

  mqttClient.on("message", async (topic, message) => {
    try {
      const raw = message.toString();
      const data = JSON.parse(raw);
      lastTelemetry = { topic, receivedAt: new Date().toISOString(), ...data };

      telemetryEvents.emit("telemetry", lastTelemetry);

      if (mongoose.connection.readyState === 1) {
        await Log.create(data);
      }
    } catch (err) {
      console.log("✗ Error handling MQTT message:", err.message);
    }
  });

  return mqttClient;
};

const publishControl = (command) => {
  if (!mqttClient) throw new Error("MQTT client not initialized");
  const payload = String(command);
  mqttClient.publish(MQTT_CONTROL_TOPIC, payload);
  return { topic: MQTT_CONTROL_TOPIC, payload };
};

const getLastTelemetry = () => lastTelemetry;
const onTelemetry = (handler) => {
  telemetryEvents.on("telemetry", handler);
  return () => telemetryEvents.off("telemetry", handler);
};

module.exports = { initMqttClient, publishControl, getLastTelemetry, onTelemetry };