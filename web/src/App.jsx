import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LabelList
} from "recharts";

const API_BASE_URL = "http://localhost:3000";

async function apiGet(path) {
  const res = await fetch(`${API_BASE_URL}${path}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

async function apiPost(path) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

function ActionButton({ label, onClick, variant = "primary", disabled = false }) {
  return (
    <button type="button" className={`btn ${variant}`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

function ToggleSwitch({ label, checked, onChange, disabled = false }) {
  return (
    <label className="switchRow">
      <span>{label}</span>
      <input
        type="checkbox"
        className="switchInput"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="switchTrack" />
    </label>
  );
}

// Helper Functions
const getLightIcon = (lightValue) => {
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour > 20;
  if (lightValue > 2500) return "☀️";
  if (lightValue > 1200) return "⛅";
  return isNight ? "🌙" : "☁️";
};

const getMoistureLevel = (soilValue) => {
  const clamped = Math.max(1100, Math.min(3400, soilValue));
  const level = Math.floor(((clamped - 1100) / (3400 - 1100)) * 12);
  return 12 - level;
};

const getWaterTankBars = (waterLevel) => {
  const clamped = Math.max(0, Math.min(4095, waterLevel));
  if (clamped > 1550) return 4;
  if (clamped > 1400) return 3;
  if (clamped > 1100) return 2;
  if (clamped > 900) return 1;
  return 0;
};

const formatTime = (ts) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(ts));
const formatShortDate = (ts) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(ts));

export default function App() {
  const [statePacket, setStatePacket] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [wateringHistory, setWateringHistory] = useState([]);
  const [sensorLogs, setSensorLogs] = useState([]);
  const [lineData, setLineData] = useState([]);
  const [dailyData, setDailyData] = useState([]);

  const [sensorPage, setSensorPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAutoPanel, setShowAutoPanel] = useState(false);
  const [hoverMoisture, setHoverMoisture] = useState(false);
  const [activeTab, setActiveTab] = useState("live");

  const state = useMemo(() => statePacket?.state || {}, [statePacket]);

  // Refresh Live Sensors
  const refreshLive = async () => {
    try {
      const data = await apiGet("/api/iot/state");
      setStatePacket(data);
    } catch (e) { console.error(e); }
  };

  // Fetch Next Watering Prediction
  const fetchPrediction = async () => {
    try {
      const data = await apiGet("/api/iot/predict-next-watering");
      setPrediction(data);
    } catch (e) {
      console.error("Prediction fetch failed", e);
      setPrediction({ prediction: "Unable to predict at this time", confidence: "low" });
    }
  };

  // Fetch History + Charts
  const fetchHistoryAndCharts = async () => {
    try {
      const [wateringRes, logsRes] = await Promise.all([
        apiGet("/api/iot/logs/watering?limit=100"),
        apiGet("/api/iot/logs/sensor?limit=200")
      ]);

      setWateringHistory(wateringRes);
      setSensorLogs(logsRes);

      // 6-Hour Soil Moisture Line Chart
      const now = Date.now();
      const sixHoursAgo = now - 6 * 60 * 60 * 1000;

      let recentLogs = logsRes
        .filter(log => new Date(log.timestamp) > sixHoursAgo)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map(log => ({
          time: formatTime(log.timestamp),
          soilMoisture: ((log.sensors?.soil1 || 0) + (log.sensors?.soil2 || 0)) / 2
        }));

      if (recentLogs.length === 0) {
        recentLogs = [{ time: "No recent data", soilMoisture: null }];
      }
      setLineData(recentLogs);

      // Last 5 Days Summary
      const dayMap = {};
      wateringRes.forEach(w => {
        const dateStr = new Date(w.timestamp).toISOString().split('T')[0];
        if (!dayMap[dateStr]) dayMap[dateStr] = { date: dateStr, wateringCount: 0, tempSum: 0, tempCount: 0 };
        dayMap[dateStr].wateringCount++;
      });

      logsRes.forEach(log => {
        const dateStr = new Date(log.timestamp).toISOString().split('T')[0];
        if (!dayMap[dateStr]) dayMap[dateStr] = { date: dateStr, wateringCount: 0, tempSum: 0, tempCount: 0 };
        const day = dayMap[dateStr];
        const hour = new Date(log.timestamp).getHours();
        if (hour >= 6 && hour <= 20 && log.sensors?.temperature) {
          day.tempSum += log.sensors.temperature;
          day.tempCount++;
        }
      });

      const daily = [];
      for (let i = 4; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayInfo = dayMap[dateStr] || { date: dateStr, wateringCount: 0, tempSum: 0, tempCount: 0 };

        daily.push({
          day: formatShortDate(d),
          wateringCount: dayInfo.wateringCount,
          avgTemp: dayInfo.tempCount > 0 ? (dayInfo.tempSum / dayInfo.tempCount).toFixed(1) : "—"
        });
      }
      setDailyData(daily);

    } catch (e) {
      console.error("Failed to fetch history", e);
    }
  };

  useEffect(() => {
    refreshLive();
    fetchPrediction();
    const timer = setInterval(refreshLive, 2000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistoryAndCharts();
      setSensorPage(0);
    }
  }, [activeTab]);

  const doAction = async (fn) => {
    setError("");
    setLoading(true);
    try {
      await fn();
      await refreshLive();
      await fetchPrediction();        // Refresh prediction after any action
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Pagination for Sensor Logs
  const logsPerPage = 10;
  const totalSensorPages = Math.ceil(sensorLogs.length / logsPerPage);
  const currentSensorLogs = sensorLogs.slice(
    sensorPage * logsPerPage,
    (sensorPage + 1) * logsPerPage
  );

  const sensors = state?.sensors || {};
  const temp = sensors.temperature ?? NaN;
  const humidity = sensors.humidity ?? NaN;
  const light = sensors.light ?? 0;
  const soil1 = sensors.soil1 ?? 0;
  const soil2 = sensors.soil2 ?? 0;
  const waterLevel = sensors.waterLevel ?? 0;

  const avgMoistureLevel = getMoistureLevel((soil1 + soil2) / 2);
  const moistureLevel1 = getMoistureLevel(soil1);
  const moistureLevel2 = getMoistureLevel(soil2);
  const tankBars = getWaterTankBars(waterLevel);
  const lightIcon = getLightIcon(light);

  return (
    <>
      <main className="page">
        <section className="hero card">
          <div>
            <h1>Garden Control Center</h1>
            <p className="muted">Beautiful watering and climate controls for your plants.</p>
          </div>
          <button className="autoPanelButton" onClick={() => setShowAutoPanel(true)}>Auto Modes</button>
        </section>

        {error && <section className="card"><p className="error">{error}</p></section>}

        <div className="tabs">
          <button className={`tab ${activeTab === "live" ? "active" : ""}`} onClick={() => setActiveTab("live")}>Live Sensors</button>
          <button className={`tab ${activeTab === "controls" ? "active" : ""}`} onClick={() => setActiveTab("controls")}>Controls</button>
          <button className={`tab ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>History & Charts</button>
        </div>

        {/* ====================== LIVE SENSORS TAB ====================== */}
        {activeTab === "live" && (
          <>
            <section className="card">
              <h2>Live Sensors</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginTop: "12px" }}>
                {/* Climate */}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "2.8rem", fontWeight: "600" }}>{isNaN(temp) ? "—" : `${Math.round(temp)}°`}</div>
                  <div style={{ fontSize: "1.15rem", color: "#9de5be", marginTop: "4px" }}>{isNaN(humidity) ? "—" : `${Math.round(humidity)}%`} humidity</div>
                  <div style={{ fontSize: "3.5rem", margin: "20px 0 8px" }}>{lightIcon}</div>
                  <div style={{ fontSize: "0.95rem", opacity: 0.8 }}>Light</div>
                </div>

                {/* Soil Moisture */}
                <div style={{ textAlign: "center", cursor: "pointer" }} onMouseEnter={() => setHoverMoisture(true)} onMouseLeave={() => setHoverMoisture(false)}>
                  <div style={{ fontSize: "4.8rem", lineHeight: 1, marginBottom: "12px" }}>💧</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: "700", color: avgMoistureLevel > 7 ? "#67d18f" : avgMoistureLevel > 4 ? "#f4c542" : "#ff8a65" }}>Soil Moisture</div>
                  <div style={{ height: hoverMoisture ? "54px" : "14px", transition: "height 0.4s ease-in-out", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {!hoverMoisture ? (
                      <div style={{ height: "14px", background: "#1e3a2e", borderRadius: "999px", overflow: "hidden" }}>
                        <div style={{ width: `${(avgMoistureLevel / 12) * 100}%`, height: "100%", background: "linear-gradient(90deg, #67d18f, #4ade80)" }} />
                      </div>
                    ) : (
                      <>
                        <div><small>Zone 1</small><div style={{ height: "10px", background: "#1e3a2e", borderRadius: "999px", marginTop: "2px", overflow: "hidden" }}><div style={{ width: `${(moistureLevel1 / 12) * 100}%`, height: "100%", background: "#67d18f" }} /></div></div>
                        <div><small>Zone 2</small><div style={{ height: "10px", background: "#1e3a2e", borderRadius: "999px", marginTop: "2px", overflow: "hidden" }}><div style={{ width: `${(moistureLevel2 / 12) * 100}%`, height: "100%", background: "#67d18f" }} /></div></div>
                      </>
                    )}
                  </div>
                </div>

                {/* Water Tank */}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "2.4rem", marginBottom: "12px" }}>🪣</div>
                  <div style={{ display: "flex", justifyContent: "center", gap: "8px", margin: "12px 0" }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ width: "20px", height: "48px", border: "2.5px solid #67d18f", borderRadius: "6px", background: i <= tankBars ? "#67d18f" : "transparent" }} />
                    ))}
                  </div>
                  <div style={{ fontSize: "0.95rem", opacity: 0.85 }}>Water Tank</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>{Math.round((tankBars / 4) * 100)}%</div>
                </div>
              </div>
            </section>

            
            {prediction && (
              <section className="card">
                <h2> Next Watering Prediction</h2>
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ fontSize: "2.6rem", fontWeight: "700", color: "#67d18f", marginBottom: "8px" }}>
                    {prediction.hoursUntil ? `${prediction.hoursUntil} hours` : "—"}
                  </div>
                  <div style={{ fontSize: "1.15rem", color: "#cbf2d8" }}>
                    {prediction.prediction}
                  </div>
                  {prediction.reason && (
                    <p style={{ marginTop: "16px", fontSize: "0.95rem", opacity: 0.9 }}>
                      {prediction.reason}
                    </p>
                  )}
                  <div style={{ marginTop: "12px", fontSize: "0.95rem", color: prediction.confidence === "high" ? "#4ade80" : "#f4c542" }}>
                    Confidence: <strong>{(prediction.confidence || "medium").toUpperCase()}</strong>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* ====================== CONTROLS TAB ====================== */}
        {activeTab === "controls" && (
          <>
            <section className="card">
              <h2>Watering</h2>
              <div className="grid">
                <ActionButton label="Water Zone 1" onClick={() => doAction(() => apiPost("/api/iot/water/zone/1"))} disabled={loading} />
                <ActionButton label="Water Zone 2" onClick={() => doAction(() => apiPost("/api/iot/water/zone/2"))} disabled={loading} />
                <ActionButton label="Stop Watering" onClick={() => doAction(() => apiPost("/api/iot/water/stop"))} variant="secondary" disabled={loading} />
              </div>
            </section>

            <section className="card">
              <h2>Actuator Controls</h2>
              <div className="grid">
                <ActionButton label="Fan ON" onClick={() => doAction(() => apiPost("/api/iot/actuators/fan/on"))} disabled={loading} />
                <ActionButton label="Fan OFF" onClick={() => doAction(() => apiPost("/api/iot/actuators/fan/off"))} variant="secondary" disabled={loading} />
                <ActionButton label="Tent OPEN" onClick={() => doAction(() => apiPost("/api/iot/tent/open"))} disabled={loading} />
                <ActionButton label="Tent CLOSE" onClick={() => doAction(() => apiPost("/api/iot/tent/close"))} variant="secondary" disabled={loading} />
              </div>
            </section>
          </>
        )}

        {/* ====================== HISTORY TAB ====================== */}
        {activeTab === "history" && (
          <section className="card">
            <h2>Soil Moisture — Last 6 Hours</h2>
            <div style={{ height: 340, marginBottom: 50 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a2e" />
                  <XAxis dataKey="time" stroke="#9de5be" />
                  <YAxis domain={[600, 3900]} stroke="#67d18f" />
                  <Tooltip contentStyle={{ backgroundColor: "#0b2f1e", border: "1px solid #67d18f" }} />
                  <Line type="natural" dataKey="soilMoisture" stroke="#4ade80" strokeWidth={4} dot={{ fill: "#4ade80", r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <h2>Last 5 Days Summary</h2>
            <div style={{ height: 340, marginBottom: 40 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a2e" />
                  <XAxis dataKey="day" stroke="#9de5be" />
                  <YAxis stroke="#67d18f" />
                  <Tooltip contentStyle={{ backgroundColor: "#0f3f25", border: "1px solid #67d18f" }} />
                  <Bar dataKey="wateringCount" fill="#3d7bf0" radius={[8, 8, 0, 0]}>
                    <LabelList dataKey="wateringCount" position="top" fill="#cbf2d8" fontSize={15} fontWeight="700" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ marginBottom: 40, color: "#9de5be" }}>
              {dailyData.map(d => (
                <span key={d.day} style={{ marginRight: "28px" }}>
                  <strong>{d.day}</strong>: Avg Temp <strong>{d.avgTemp}°C</strong>
                </span>
              ))}
            </div>

            <h2>Watering History</h2>
            <div style={{ overflowX: "auto", marginBottom: 50 }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Zone</th>
                    <th>Trigger</th>
                    <th>Soil 1</th>
                    <th>Soil 2</th>
                    <th>Water Level</th>
                  </tr>
                </thead>
                <tbody>
                  {wateringHistory.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: "center", padding: "25px" }}>No watering events yet</td></tr>
                  ) : (
                    wateringHistory.map((event, i) => (
                      <tr key={i}>
                        <td>{formatShortDate(event.timestamp)} {formatTime(event.timestamp)}</td>
                        <td><strong>Zone {event.zone}</strong></td>
                        <td><span className={`tag ${event.trigger}`}>{event.trigger.toUpperCase()}</span></td>
                        <td>{Math.round(event.sensorsBefore?.soil1 || 0)}</td>
                        <td>{Math.round(event.sensorsBefore?.soil2 || 0)}</td>
                        <td>{Math.round(event.sensorsBefore?.waterLevel || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h2>Sensor Logs History</h2>
            <div style={{ overflowX: "auto", marginBottom: 15 }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Temp °C</th>
                    <th>Humidity %</th>
                    <th>Soil 1</th>
                    <th>Soil 2</th>
                    <th>Light</th>
                    <th>Water Level</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSensorLogs.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: "center", padding: "30px" }}>No sensor logs available</td></tr>
                  ) : (
                    currentSensorLogs.map((log, i) => (
                      <tr key={i}>
                        <td>{formatShortDate(log.timestamp)} {formatTime(log.timestamp)}</td>
                        <td>{log.sensors?.temperature?.toFixed(1) ?? "—"}</td>
                        <td>{log.sensors?.humidity?.toFixed(0) ?? "—"}</td>
                        <td>{log.sensors?.soil1 ?? "—"}</td>
                        <td>{log.sensors?.soil2 ?? "—"}</td>
                        <td>{log.sensors?.light ?? "—"}</td>
                        <td>{log.sensors?.waterLevel ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalSensorPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "15px" }}>
                <button className="btn secondary" onClick={() => setSensorPage(p => Math.max(0, p - 1))} disabled={sensorPage === 0}>Previous</button>
                <span style={{ alignSelf: "center", color: "#9de5be" }}>Page {sensorPage + 1} of {totalSensorPages}</span>
                <button className="btn secondary" onClick={() => setSensorPage(p => Math.min(totalSensorPages - 1, p + 1))} disabled={sensorPage === totalSensorPages - 1}>Next</button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Auto Modes Panel */}
      <div className={`overlay ${showAutoPanel ? "show" : ""}`} onClick={() => setShowAutoPanel(false)} />
      <aside className={`autoPanel ${showAutoPanel ? "show" : ""}`}>
        <div className="autoHeader">
          <h3>Auto Modes</h3>
          <button type="button" className="closePanel" onClick={() => setShowAutoPanel(false)}>×</button>
        </div>
        <ToggleSwitch label="Pump Auto" checked={!!state?.actuators?.pump?.autoEnabled} onChange={v => doAction(() => apiPost(`/api/iot/actuators/pump/auto/${v ? "on" : "off"}`))} disabled={loading} />
        <ToggleSwitch label="Fan Auto" checked={!!state?.actuators?.fan?.autoEnabled} onChange={v => doAction(() => apiPost(`/api/iot/actuators/fan/auto/${v ? "on" : "off"}`))} disabled={loading} />
        <ToggleSwitch label="Tent Auto" checked={!!state?.actuators?.tent?.autoEnabled} onChange={v => doAction(() => apiPost(`/api/iot/actuators/tent/auto/${v ? "on" : "off"}`))} disabled={loading} />
      </aside>
    </>
  );
}