const Log = require("../models/Log");

exports.createLog = async (req, res) => {
  const log = await Log.create(req.body);
  res.json(log);
};

exports.getLogs = async (req, res) => {
  const logs = await Log.find().sort({ timestamp: -1 }).limit(100);
  res.json(logs);
};