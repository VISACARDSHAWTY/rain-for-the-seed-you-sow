const mongoose = require("mongoose");
const mqtt = require("mqtt");
const Log = require("../models/Log");

const MQTT_URL = "mqtt://10.52.170.186:1883";
const MQTT_TOPIC = "smartplant/data";

const initMqttClient = () => {
  const client = mqtt.connect(MQTT_URL);

  client.on("connect", () => {
    console.log("✓ MQTT connected");
    client.subscribe(MQTT_TOPIC, (err) => {
      if (err) console.log("✗ Subscribe error:", err.message);
      else console.log(`✓ Subscribed to ${MQTT_TOPIC}`);
    });
  });

  client.on("error", (err) => {
    console.log("✗ MQTT Error:", err.message);
  });

  client.on("disconnect", () => {
    console.log("✗ MQTT disconnected");
  });

  client.on("message", async (topic, message) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        console.log("✗ MongoDB not ready; skipping MQTT message");
        return;
      }

      const raw = message.toString();
      const data = JSON.parse(raw);
      await Log.create(data);
      console.log(`✓ Data saved to DB from ${topic}`);
    } catch (err) {
      console.log("✗ Error saving data:", err.message);
    }
  });

  return client;
};

module.exports = initMqttClient;