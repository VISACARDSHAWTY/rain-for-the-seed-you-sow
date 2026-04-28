const express = require("express");
const router = express.Router();

const {
  getLatestState,
  setActuatorState,
  setAutoMode,
  setActuatorAuto,
  startWaterZone,
  stopWaterZone,
  setTentState
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

router.post("/actuators/:name/auto/on", (req, res) =>
  setActuatorAuto(req, res, { state: "on" })
);
router.post("/actuators/:name/auto/off", (req, res) =>
  setActuatorAuto(req, res, { state: "off" })
);

router.post("/water/zone/:zone", startWaterZone);
router.post("/water/stop", stopWaterZone);
router.post("/tent/open", (req, res) => setTentState(req, res, { state: "open" }));
router.post("/tent/close", (req, res) => setTentState(req, res, { state: "close" }));

module.exports = router;

