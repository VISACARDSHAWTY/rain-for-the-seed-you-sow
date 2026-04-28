const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const connectDB = require("../config/db");
const { initMqttClient } = require("./mqttClient");

const logRoutes = require("../routes/logRoutes");
const iotRoutes = require("../routes/iotRoutes");
const { attachSse } = require("../controllers/iotController");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/logs", logRoutes);
app.use("/api/iot", iotRoutes);
attachSse(app);

const bootstrap = async () => {
  try {
    try {
      await connectDB();
    } catch (err) {
      console.log("! MongoDB unavailable; continuing without DB persistence");
    }
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