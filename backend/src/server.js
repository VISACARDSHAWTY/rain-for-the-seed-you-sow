require("dotenv").config();
const express = require("express");
const connectDB = require("../config/db");

const logRoutes = require("../routes/logRoutes");

const app = express();
app.use(express.json());

connectDB();

app.use("/api/logs", logRoutes);

app.listen(process.env.PORT, () => {
  console.log(`SERVER RUNNING (port = ${process.env.PORT})`);
});