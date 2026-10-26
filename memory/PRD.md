# G-14 Aether Wave — HUD Visor Simulator (PRD)

## Original problem
User is building the G-14 Aether Wave helmet (electrical/mechanical progressing). Needs a HUD mockup/simulation to preview the diegetic HUD before testing in Unreal, plus starter code. Infographics + parts list (ADS1299 EEG, BMI270 IMU, TSL1401CL scan, MAX30102 PPG, ESP32/Teensy) provided.

## Architecture
- Frontend (React): client-side simulation (`lib/sim.js` buildFrame -> g14.hud.v1 message), rAF loop (`hooks/useSimulation.js`), canvas HUD elements, custom drawers.
- Backend (FastAPI): WebSocket relay `/api/ws/hud` (role=publisher|subscriber), `POST /api/telemetry`, `GET /api/telemetry/latest`, `GET /api/stream/status`, `GET /api/unreal/files`, `GET /api/unreal/kit.zip`. In-memory hub, no DB persistence.
- Unreal kit files in `/app/backend/unreal_kit` (Types, TelemetryReceiver actor, HudWidget base, Build.cs, module cpp, sample JSON, README).

## Implemented (2026-06)
- Through-visor view, parallax city background, visor mask, scanlines, curvature
- Entity silhouettes (Ahrimanic red / Luciferic dampened cyan / Unknown), brackets + labels
- Cymatic radar (Chladni), Lissajous reticle -> Metatron's cube stable zone, target readout
- Stasis meter (EEG bands, waveform, state), dynamic compass + rose, head sway
- Sensor drawer: sliders, presets Calm/Combat/Overload, layer toggles, throttling, scanlines
- Observer throttling tiers 0/1/2 from cognitive load
- Live data feed + Stream to Unreal (WebSocket publisher)
- Unreal Kit page: file viewer, copy/download, zip, endpoints, schema table
- Tested: iteration_1 all pass

## Backlog
- P1: Spinal rig bar (MAX30102 HR/SpO2/HRV) + bio telemetry panels
- P1: Live ESP32/Teensy feed in place of simulated data
- P2: Saved presets/layouts; session record/replay; ESP32-CAM background; exportable HUD style settings for UMG
