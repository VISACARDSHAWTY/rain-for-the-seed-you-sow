const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Log = require("./models/Log");
const WateringEvent = require("./models/WateringEvent");
const connectDB = require("./config/db");

const SOIL_WET = 1200;
const SOIL_DRY = 2400;
const CYCLE_MS = 3 * 60 * 60 * 1000;
const MIN_WATER_INTERVAL = 3.5 * 60 * 60 * 1000;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const generateData = async () => {
  await connectDB();

  await Log.deleteMany({});
  await WateringEvent.deleteMany({});

  console.log("Generating FIXED soil trend simulation...");

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 10);

  const logs = [];
  const waterings = [];

  let currentTime = new Date(startDate);
  let lastWateringTime = new Date(startDate);

  let dailyWaterTarget = 6;
  let dailyCount = 0;
  let currentDay = currentTime.getDate();

  while (currentTime < now) {

    if (currentTime.getDate() !== currentDay) {
      currentDay = currentTime.getDate();
      dailyWaterTarget = 5 + Math.floor(Math.random() * 4); // 5–8
      dailyCount = 0;
    }

    
    const timeSinceWater = currentTime - lastWateringTime;

    let progress = timeSinceWater / CYCLE_MS;
    progress = Math.min(progress, 1);

    
    let baseSoil = SOIL_WET + progress * (SOIL_DRY - SOIL_WET);

    const noise1 = (Math.random() - 0.5) * 35; 
    const noise2 = (Math.random() - 0.5) * 35;

    let soil1 = baseSoil + noise1;
    let soil2 = baseSoil + noise2;

    soil1 = clamp(soil1, 1150, 2450);
    soil2 = clamp(soil2, 1150, 2450);

  
    const temp =
      19 + Math.sin(currentTime.getHours() / 3) * 7 + Math.random() * 4;

    const humidity = 45 + Math.random() * 40;

    const light =
      currentTime.getHours() >= 6 && currentTime.getHours() <= 20
        ? 700 + Math.random() * 2200
        : 20 + Math.random() * 100;

    const waterLevel = 900 + Math.random() * 3000;


    const canWater =
      currentTime - lastWateringTime > MIN_WATER_INTERVAL;

    const needsWater =
      soil1 >= 2350 || soil2 >= 2350;

    const underDailyLimit = dailyCount < dailyWaterTarget;

    if (canWater && needsWater && underDailyLimit) {
      const zone = soil1 > soil2 ? 1 : 2;

      waterings.push({
        timestamp: new Date(currentTime),
        zone,
        trigger: "auto",
        sensorsBefore: {
          soil1: Math.round(soil1),
          soil2: Math.round(soil2),
          waterLevel: Math.round(waterLevel),
        },
      });

      soil1 = SOIL_WET;
      soil2 = SOIL_WET;

      lastWateringTime = new Date(currentTime);
      dailyCount++;
    }

    logs.push({
      timestamp: new Date(currentTime),
      sensors: {
        soil1: Math.round(soil1),
        soil2: Math.round(soil2),
        temperature: Math.round(temp * 10) / 10,
        humidity: Math.round(humidity),
        light: Math.round(light),
        waterLevel: Math.round(waterLevel),
      },
      actuators: {
        pump: { state: false, source: "auto" },
        fan: { state: temp > 31, source: "auto" },
        buzzer: { state: false, source: "auto" },
        servoAngle: light > 1400 ? 80 : 0,
        zone: 0,
      },
    });


    const minutesToAdd = 1 + Math.random();
    currentTime.setMinutes(currentTime.getMinutes() + minutesToAdd);
  }

  console.log(
    `Inserted ${logs.length.toLocaleString()} logs / ${waterings.length} waterings`
  );

  await Log.insertMany(logs);
  await WateringEvent.insertMany(waterings);

  console.log("DONE");
  process.exit(0);
};

generateData().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});