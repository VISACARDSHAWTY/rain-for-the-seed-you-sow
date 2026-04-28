import { useEffect, useMemo, useState } from "react";
import "./App.css";

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
    <button
      type="button"
      className={`btn ${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
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

// Helper functions
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

const formatDate = (timestamp) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
};

export default function App() {
  const [statePacket, setStatePacket] = useState(null);
  const [wateringHistory, setWateringHistory] = useState([]);
  const [sensorLogs, setSensorLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAutoPanel, setShowAutoPanel] = useState(false);
  const [hoverMoisture, setHoverMoisture] = useState(false);
  const [activeTab, setActiveTab] = useState("live"); // "live", "controls", "history"

  const state = useMemo(() => statePacket?.state || {}, [statePacket]);

  const refreshLive = async () => {
    try {
      const data = await apiGet("/api/iot/state");
      setStatePacket(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async () => {
    try {
      const [wateringRes, logsRes] = await Promise.all([
        apiGet("/api/iot/logs/watering?limit=30"),
        apiGet("/api/iot/logs/sensor?limit=50")
      ]);
      setWateringHistory(wateringRes);
      setSensorLogs(logsRes);
    } catch (e) {
      console.error("Failed to fetch history", e);
    }
  };

  useEffect(() => {
    refreshLive();
    const timer = setInterval(refreshLive, 2000);
    return () => clearInterval(timer);
  }, []);

  // Load history when switching to History tab
  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

  const doAction = async (fn) => {
    setError("");
    setLoading(true);
    try {
      await fn();
      await refreshLive();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

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
            <p className="apiHint">API <code>{API_BASE_URL}</code></p>
          </div>
          <button
            type="button"
            className="autoPanelButton"
            onClick={() => setShowAutoPanel(true)}
          >
            Auto Modes
          </button>
        </section>

        {error && <section className="card"><p className="error">{error}</p></section>}

        {/* TABS */}
        <div className="tabs">
          <button className={`tab ${activeTab === "live" ? "active" : ""}`} onClick={() => setActiveTab("live")}>
            Live Sensors
          </button>
          <button className={`tab ${activeTab === "controls" ? "active" : ""}`} onClick={() => setActiveTab("controls")}>
            Controls
          </button>
          <button className={`tab ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>
            History
          </button>
        </div>

        {/* ====================== LIVE SENSORS TAB ====================== */}
        {activeTab === "live" && (
          <section className="card">
            <h2>Live Sensors</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginTop: "12px" }}>
              {/* Climate */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2.8rem", fontWeight: "600" }}>
                  {isNaN(temp) ? "—" : `${Math.round(temp)}°`}
                </div>
                <div style={{ fontSize: "1.15rem", color: "#9de5be", marginTop: "4px" }}>
                  {isNaN(humidity) ? "—" : `${Math.round(humidity)}%`} humidity
                </div>
                <div style={{ fontSize: "3.5rem", margin: "20px 0 8px" }}>{lightIcon}</div>
                <div style={{ fontSize: "0.95rem", opacity: 0.8 }}>Light</div>
              </div>

              {/* Soil Moisture */}
              <div 
                style={{ textAlign: "center", cursor: "pointer" }}
                onMouseEnter={() => setHoverMoisture(true)}
                onMouseLeave={() => setHoverMoisture(false)}
              >
                <div style={{ fontSize: "4.8rem", lineHeight: 1, marginBottom: "12px" }}>💧</div>
                <div style={{ fontSize: "1.25rem", fontWeight: "700", color: avgMoistureLevel > 7 ? "#67d18f" : avgMoistureLevel > 4 ? "#f4c542" : "#ff8a65" }}>
                  Soil Moisture
                </div>

                <div style={{ height: hoverMoisture ? "54px" : "14px", transition: "height 0.4s ease-in-out", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {!hoverMoisture ? (
                    <div style={{ height: "14px", background: "#1e3a2e", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: `${(avgMoistureLevel / 12) * 100}%`, height: "100%", background: "linear-gradient(90deg, #67d18f, #4ade80)", transition: "width 0.6s ease" }} />
                    </div>
                  ) : (
                    <>
                      <div><small>Zone 1</small>
                        <div style={{ height: "10px", background: "#1e3a2e", borderRadius: "999px", overflow: "hidden", marginTop: "2px" }}>
                          <div style={{ width: `${(moistureLevel1 / 12) * 100}%`, height: "100%", background: "#67d18f" }} />
                        </div>
                      </div>
                      <div><small>Zone 2</small>
                        <div style={{ height: "10px", background: "#1e3a2e", borderRadius: "999px", overflow: "hidden", marginTop: "2px" }}>
                          <div style={{ width: `${(moistureLevel2 / 12) * 100}%`, height: "100%", background: "#67d18f" }} />
                        </div>
                      </div>
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
            <h2>Watering History</h2>
            <div style={{ overflowX: "auto", marginTop: "16px" }}>
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
                    <tr><td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>No watering events yet</td></tr>
                  ) : (
                    wateringHistory.map((event, i) => (
                      <tr key={i}>
                        <td>{formatDate(event.timestamp)}</td>
                        <td><strong>Zone {event.zone}</strong></td>
                        <td><span className={`tag ${event.trigger}`}>{event.trigger}</span></td>
                        <td>{event.sensorsBefore?.soil1 ?? "-"}</td>
                        <td>{event.sensorsBefore?.soil2 ?? "-"}</td>
                        <td>{event.sensorsBefore?.waterLevel ?? "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h2 style={{ marginTop: "40px" }}>Recent Sensor Logs</h2>
            <div style={{ overflowX: "auto" }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Temp °C</th>
                    <th>Humidity %</th>
                    <th>Soil 1</th>
                    <th>Soil 2</th>
                    <th>Light</th>
                  </tr>
                </thead>
                <tbody>
                  {sensorLogs.slice(0, 15).map((log, i) => (
                    <tr key={i}>
                      <td>{formatDate(log.timestamp)}</td>
                      <td>{log.sensors?.temperature?.toFixed(1) ?? "-"}</td>
                      <td>{log.sensors?.humidity?.toFixed(0) ?? "-"}</td>
                      <td>{log.sensors?.soil1 ?? "-"}</td>
                      <td>{log.sensors?.soil2 ?? "-"}</td>
                      <td>{log.sensors?.light ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        <ToggleSwitch label="Pump Auto" checked={!!state?.actuators?.pump?.autoEnabled} onChange={(v) => doAction(() => apiPost(`/api/iot/actuators/pump/auto/${v ? "on" : "off"}`))} disabled={loading} />
        <ToggleSwitch label="Fan Auto" checked={!!state?.actuators?.fan?.autoEnabled} onChange={(v) => doAction(() => apiPost(`/api/iot/actuators/fan/auto/${v ? "on" : "off"}`))} disabled={loading} />
        <ToggleSwitch label="Tent Auto" checked={!!state?.actuators?.tent?.autoEnabled} onChange={(v) => doAction(() => apiPost(`/api/iot/actuators/tent/auto/${v ? "on" : "off"}`))} disabled={loading} />
      </aside>
    </>
  );
}