const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },

  sensors: {
    soil1: Number,
    soil2: Number,
    temperature: Number,
    humidity: Number,
    light: Number,
    waterLevel: Number
  },

  actuators: {
    pump: {
      state: Boolean,
      source: String
    },
    fan: {
      state: Boolean,
      source: String
    },
    buzzer: {
      state: Boolean,
      source: String
    },
    servoAngle: Number,
    zone: Number
  }
});

module.exports = mongoose.model("Log", logSchema);