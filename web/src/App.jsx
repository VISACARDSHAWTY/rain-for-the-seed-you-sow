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

export default function App() {
  const [statePacket, setStatePacket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAutoPanel, setShowAutoPanel] = useState(false);

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
    <>
      <main className="page">
        <section className="hero card">
          <div>
            <h1>Garden Control Center</h1>
            <p className="muted">
              Beautiful watering and climate controls for your plants.
            </p>
            <p className="apiHint">
              API <code>{API_BASE_URL}</code>
            </p>
          </div>
          <button
            type="button"
            className="autoPanelButton"
            onClick={() => setShowAutoPanel(true)}
          >
            Auto Modes
          </button>
        </section>

        {error ? (
          <section className="card">
            <p className="error">{error}</p>
          </section>
        ) : null}

        <section className="card">
          <h2>Live State</h2>
          <div className="row">
            <span>Source</span>
            <strong>{statePacket?.source || "none"}</strong>
          </div>
          <div className="row">
            <span>Pump</span>
            <strong>{state?.actuators?.pump?.state ? "ON" : "OFF"}</strong>
          </div>
          <div className="row">
            <span>Fan</span>
            <strong>{state?.actuators?.fan?.state ? "ON" : "OFF"}</strong>
          </div>
          <div className="row">
            <span>Tent (Servo)</span>
            <strong>{state?.actuators?.tent?.state ? "OPEN" : "CLOSED"}</strong>
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
          <h2>Watering</h2>
          <div className="grid">
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

        <section className="card">
          <h2>Actuator Controls</h2>
          <div className="grid">
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
              label="Tent OPEN"
              onClick={() => doAction(() => apiPost("/api/iot/tent/open"))}
              disabled={loading}
            />
            <ActionButton
              label="Tent CLOSE"
              onClick={() => doAction(() => apiPost("/api/iot/tent/close"))}
              variant="secondary"
              disabled={loading}
            />
          </div>
        </section>
      </main>

      <div
        className={`overlay ${showAutoPanel ? "show" : ""}`}
        onClick={() => setShowAutoPanel(false)}
      />
      <aside className={`autoPanel ${showAutoPanel ? "show" : ""}`}>
        <div className="autoHeader">
          <h3>Auto Modes</h3>
          <button
            type="button"
            className="closePanel"
            onClick={() => setShowAutoPanel(false)}
          >
            ×
          </button>
        </div>
        <ToggleSwitch
          label="Pump Auto"
          checked={!!state?.actuators?.pump?.autoEnabled}
          onChange={(value) =>
            doAction(() =>
              apiPost(`/api/iot/actuators/pump/auto/${value ? "on" : "off"}`)
            )
          }
          disabled={loading}
        />
        <ToggleSwitch
          label="Fan Auto"
          checked={!!state?.actuators?.fan?.autoEnabled}
          onChange={(value) =>
            doAction(() =>
              apiPost(`/api/iot/actuators/fan/auto/${value ? "on" : "off"}`)
            )
          }
          disabled={loading}
        />
        <ToggleSwitch
          label="Tent Auto"
          checked={!!state?.actuators?.tent?.autoEnabled}
          onChange={(value) =>
            doAction(() =>
              apiPost(`/api/iot/actuators/tent/auto/${value ? "on" : "off"}`)
            )
          }
          disabled={loading}
        />
      </aside>
    </>
  );
}
