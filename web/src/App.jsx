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

export default function App() {
  const [statePacket, setStatePacket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const state = useMemo(() => statePacket?.state || {}, [statePacket]);

  const refresh = async () => {
    const data = await apiGet("/api/iot/state");
    setStatePacket(data);
  };

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      refresh().catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const doAction = async (fn) => {
    setError("");
    setLoading(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="card">
        <h1>SmartPlant Web Controller</h1>
        <p className="muted">
          Backend API: <code>{API_BASE_URL}</code>
        </p>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="card">
        <h2>Live State</h2>
        <div className="row">
          <span>Source</span>
          <strong>{statePacket?.source || "none"}</strong>
        </div>
        <div className="row">
          <span>Pump</span>
          <strong>
            {state?.actuators?.pump?.state ? "ON" : "OFF"} | auto:{" "}
            {state?.actuators?.pump?.autoEnabled ? "ON" : "OFF"}
          </strong>
        </div>
        <div className="row">
          <span>Fan</span>
          <strong>
            {state?.actuators?.fan?.state ? "ON" : "OFF"} | auto:{" "}
            {state?.actuators?.fan?.autoEnabled ? "ON" : "OFF"}
          </strong>
        </div>
        <div className="row">
          <span>Buzzer</span>
          <strong>{state?.actuators?.buzzer?.state ? "ON" : "OFF"}</strong>
        </div>
        <div className="row">
          <span>Water mode</span>
          <strong>
            {state?.actuators?.manualWaterZone
              ? `Zone ${state?.actuators?.manualWaterZone}`
              : "Auto/Idle"}
          </strong>
        </div>
        <div className="row">
          <span>Current zone</span>
          <strong>{state?.actuators?.zone ?? "?"}</strong>
        </div>
      </section>

      <section className="card">
        <h2>Controls</h2>
        <div className="grid">
          <ActionButton
            label="Pump ON"
            onClick={() => doAction(() => apiPost("/api/iot/actuators/pump/on"))}
            disabled={loading}
          />
          <ActionButton
            label="Pump OFF"
            onClick={() => doAction(() => apiPost("/api/iot/actuators/pump/off"))}
            variant="secondary"
            disabled={loading}
          />
          <ActionButton
            label="Pump Auto ON"
            onClick={() => doAction(() => apiPost("/api/iot/actuators/pump/auto/on"))}
            disabled={loading}
          />
          <ActionButton
            label="Pump Auto OFF"
            onClick={() => doAction(() => apiPost("/api/iot/actuators/pump/auto/off"))}
            variant="secondary"
            disabled={loading}
          />
          <ActionButton
            label="Fan ON"
            onClick={() => doAction(() => apiPost("/api/iot/actuators/fan/on"))}
            disabled={loading}
          />
          <ActionButton
            label="Fan OFF"
            onClick={() => doAction(() => apiPost("/api/iot/actuators/fan/off"))}
            variant="secondary"
            disabled={loading}
          />
          <ActionButton
            label="Fan Auto ON"
            onClick={() => doAction(() => apiPost("/api/iot/actuators/fan/auto/on"))}
            disabled={loading}
          />
          <ActionButton
            label="Fan Auto OFF"
            onClick={() => doAction(() => apiPost("/api/iot/actuators/fan/auto/off"))}
            variant="danger"
            disabled={loading}
          />
          <ActionButton
            label="Water Zone 1"
            onClick={() => doAction(() => apiPost("/api/iot/water/zone/1"))}
            disabled={loading}
          />
          <ActionButton
            label="Water Zone 2"
            onClick={() => doAction(() => apiPost("/api/iot/water/zone/2"))}
            disabled={loading}
          />
          <ActionButton
            label="Stop Watering"
            onClick={() => doAction(() => apiPost("/api/iot/water/stop"))}
            variant="secondary"
            disabled={loading}
          />
        </div>
      </section>
    </main>
  );
}
