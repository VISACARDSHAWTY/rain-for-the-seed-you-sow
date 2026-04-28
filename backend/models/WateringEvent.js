const mongoose = require("mongoose");

const wateringEventSchema = new mongoose.Schema({
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  zone: {
    type: Number,
    required: true,
    enum: [1, 2]
  },
  trigger: {
    type: String,
    required: true,
    enum: ["manual", "auto"]
  },
  sensorsBefore: {
    soil1: Number,
    soil2: Number,
    waterLevel: Number
  },
  
  notes: String
});

module.exports = mongoose.model("WateringEvent", wateringEventSchema);