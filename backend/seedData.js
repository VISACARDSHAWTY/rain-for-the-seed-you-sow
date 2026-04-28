const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Log = require("./models/Log");
const WateringEvent = require("./models/WateringEvent");
const connectDB = require("./config/db");

const generateData = async () => {
  await connectDB();
  console.log("Connected to MongoDB. Clearing old data...");

  await Log.deleteMany({});
  await WateringEvent.deleteMany({});

  console.log("Generating dense sensor data (every 1-2 minutes) for the last 10 days...");

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 10);

  const logs = [];
  const waterings = [];

  let currentTime = new Date(startDate);
  let lastWateringTime = new Date(startDate);

  while (currentTime < now) {
    
    const baseSoil = 1650 + Math.random() * 1600;           
    const soil1 = Math.round(baseSoil + (Math.random() - 0.5) * 450);
    const soil2 = Math.round(baseSoil + (Math.random() - 0.5) * 550);

    const temp = 19 + Math.sin(currentTime.getHours() / 3) * 8 + Math.random() * 9; // natural daily cycle
    const humidity = 40 + Math.random() * 50;
    const light = (currentTime.getHours() >= 6 && currentTime.getHours() <= 20) 
                  ? 600 + Math.random() * 2600 
                  : 10 + Math.random() * 200;

    const waterLevel = 900 + Math.random() * 3100;

    logs.push({
      timestamp: new Date(currentTime),
      sensors: {
        soil1: Math.max(600, Math.min(3900, soil1)),
        soil2: Math.max(600, Math.min(3900, soil2)),
        temperature: Math.round(temp * 10) / 10,
        humidity: Math.round(humidity),
        light: Math.round(light),
        waterLevel: Math.round(waterLevel)
      },
      actuators: {
        pump: { state: false, source: "auto" },
        fan: { state: temp > 31, source: "auto" },
        buzzer: { state: false, source: "auto" },
        servoAngle: light > 1400 ? 80 : 0,
        zone: 0
      }
    });

    
    if (Math.random() < 0.018 && (currentTime - lastWateringTime) > 4 * 60 * 60 * 1000) { // min 4 hours between waterings
      const zone = Math.random() > 0.5 ? 1 : 2;
      waterings.push({
        timestamp: new Date(currentTime),
        zone,
        trigger: Math.random() > 0.65 ? "auto" : "manual",
        sensorsBefore: {
          soil1: Math.round(soil1),
          soil2: Math.round(soil2),
          waterLevel: Math.round(waterLevel)
        }
      });
      lastWateringTime = new Date(currentTime);
    }

    
    const minutesToAdd = 1 + Math.random() * 1;   // 1 to 2 minutes
    currentTime.setMinutes(currentTime.getMinutes() + minutesToAdd);
  }

  console.log(`Inserting ${logs.length.toLocaleString()} sensor logs and ${waterings.length} watering events...`);

  await Log.insertMany(logs);
  await WateringEvent.insertMany(waterings);

  console.log("✅ Data generation completed successfully!");
  console.log(`   → Sensor Logs: ${logs.length.toLocaleString()}`);
  console.log(`   → Watering Events: ${waterings.length}`);
  
  process.exit(0);
};

generateData().catch(err => {
  console.error("❌ Error generating data:", err);
  process.exit(1);
});