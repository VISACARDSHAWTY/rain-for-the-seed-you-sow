# rain-for-the-seed-you-sow

## Architecture

- `firmware/`: ESP32 firmware publishes telemetry to MQTT `smartplant/data` and reads commands from `smartplant/control`.
- `backend/`: Express API + MQTT bridge.
- `web/`: React (Vite) web controller UI.

## Backend API

Base URL: `http://localhost:3000`

- `GET /api/iot/state` - latest telemetry/state
- `POST /api/iot/actuators/pump/on`
- `POST /api/iot/actuators/pump/off`
- `POST /api/iot/actuators/fan/on`
- `POST /api/iot/actuators/fan/off`
- `POST /api/iot/auto/on`
- `POST /api/iot/auto/off`
- `GET /api/iot/stream` - optional SSE stream

## Run

### 1) Start backend

```bash
cd backend
npm run dev
```

### 2) Start web app

```bash
cd web
npm run dev
```

Open the URL shown by Vite (usually `http://localhost:5173`).

## Configuration

- Backend MQTT settings are in `backend/.env`:
  - `MQTT_URL`
  - `MQTT_DATA_TOPIC`
  - `MQTT_CONTROL_TOPIC`
- Web API URL is in `web/src/App.jsx`:
  - `API_BASE_URL`

