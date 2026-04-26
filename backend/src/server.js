require("dotenv").config();
const express = require("express");
const connectDB = require("../config/db");
const initMqttClient = require("./mqttClient");

const logRoutes = require("../routes/logRoutes");

const app = express();
app.use(express.json());

app.use("/api/logs", logRoutes);

const bootstrap = async () => {
  try {
    await connectDB();
    initMqttClient();

    app.listen(process.env.PORT, () => {
      console.log(`✓ SERVER RUNNING (port = ${process.env.PORT})`);
    });
  } catch (err) {
    console.log("✗ Startup failed:", err.message);
    process.exit(1);
  }
};

bootstrap();