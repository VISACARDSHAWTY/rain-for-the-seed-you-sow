const express = require("express");
const router = express.Router();

const {
  getLatestState,
  setActuatorState,
  setAutoMode
} = require("../controllers/iotController");

router.get("/state", getLatestState);

router.post("/actuators/:name/on", (req, res) =>
  setActuatorState(req, res, { state: "on" })
);
router.post("/actuators/:name/off", (req, res) =>
  setActuatorState(req, res, { state: "off" })
);

router.post("/auto/on", (req, res) => setAutoMode(req, res, { state: "on" }));
router.post("/auto/off", (req, res) =>
  setAutoMode(req, res, { state: "off" })
);

module.exports = router;

