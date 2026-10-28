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

## Hallway page (/hallway) — added 2026-06
- 100 m asylum corridor, player stationary, entities approach in 10/20 m steps (manual, slider, or auto every 3.5 s)
- Stages by distance: DETECTED >80, CLASSIFYING >60, IDENTIFIED >40, TRACKING >20, PROXIMITY
- Observer filter: generated original necromorph-style overlays (screen-blended); off = raw/unresolved feed + load spike
- Entities: Moon Pygmy swarm ×4, Venus Wraith (Peltier counter), Paperclip Golem (528 Hz counter), Machine Gnomes ×2 (NEUTRAL/SUBMITTED/HOSTILE), stationary boss The Composite at 97 m with observation % → transmutation ready
- Callout labels in measured, non-overlapping columns with leader lines; event log; corridor progress bar; frames streamed with scene/type/stage/disposition (Unreal kit types updated)
- Tested: iteration_3 pass + fixes (drawer under top bar, label overlap, checkpoint timing, stage hysteresis, reset, filter-off labels)

## Zone Rooms + 3-Vector Ghost mode — added 2026-06
- Zones: Wards (silver), Mess Hall (copper/green), Administration (violet), Boiler Room (rust red) with own backdrops, tints and rosters; boss at the end of each
- Ghost HUD (default, from RAIDEN-V "Dead Core" sheet): max 3 focus threats (2 under Calm Assist), no text callouts; RED apex zone + brake line, BLUE wall/ceiling glide path, YELLOW nanite-stream centreline; rank+distance tags; peripheral edge glows; optional stereo-panned audio pings
- MAX30102 heart rate simulated from proximity × composure; ≥110 BPM → Calm Assist (box-breathing pacer, blue hidden, overload frame suppressed)
- Full Analyst mode keeps the detailed HUD; Unreal types gained Bio, Zone, Mode, CalmAssist, FocusIds
- Tested: iteration_4 pass; fixed tag stacking, bigger apex zone, legend placement, calm-assist overload suppression

## Visor physics + calm-by-default + gaze reveal — added 2026-06
- VisorFrame (both pages): edge refraction blur, dark curved bevel, chromatic fringe, specular streaks, faint mirrored face reflection, breath fog (rate + density from heart rate), corner condensation
- Ghost alert ladder (hud.alert_level): 0 QUIET (nothing but a faint dot reticle) → 1 PERIPHERAL (edge glow + one-shot flash on change, focus >40 m) → 2 AUDIO (pings + rank tags + yellow stream, ≤40 m) → 3 OVERLAY (all vectors, radar, ≤20 m); based on nearest focus entity distance
- Gaze reveal: slider or mouse; left = vitals ring + radar + zone, right = telemetry column + progress; fade 450 ms
- Tested: iteration_5 all pass

## Observer Throttle priority system + Baseline — added 2026-06
- Hallway default mode THROTTLE (Ghost + Analyst still selectable); load auto or manual slider
- Tiers T0–T3 per user spec with 300 ms fades; contact score = threat × 1/d × approach bonus; top card w/ leader line, tags for others; 20% hysteresis on top card
- Centre clear zone (25% width, +16 px margin), card→tag collapse on overlap, ≤3 labels per screen third
- Stasis passive unless drift/gaze; inertial panel lag (~100 ms); T3 soft red visor-arc pulse + direction arrow
- /baseline tab: 60 s (or fast 6 s) EM/thermal/IMU recording → localStorage g14.baseline; HUD chip BASELINE STABLE / DEVIATION +X% (4σ & ≥5%)
- Tested: iteration_6 + fixes (baseline flicker, clear-zone margin, card hysteresis, region counting, zone badge hidden T1+)

## Visor luciferic entities + natural head motion + Live Vector Run — added 2026-06
- Visor (/): new generated luciferic art (Halo Seraph, Glass Herald, Veiled Choir) + Iron Egregore (ahrimanic); screen-blended, soft-masked, stage classification by range (DETECTED→PROXIMITY), raw blur until identified
- Visor reuses hallway throttle contact layout: cards with leader lines (FALSE LIGHT DAMPENER %), tags, clear-zone, tier caps; labels kept off side panel columns; stage event log (max 3)
- Head motion (both pages): breathing bob + slow postural drift (±~1.5°), replaces ±9° yaw swing; gait bob when running
- Hallway LIVE VECTOR RUN: OFF / MANUAL (W walk, Shift sprint, C crouch, X prone, cruise slider default 0) / AUTO (walk→sprint→slow→crouch near contacts); body height slider; eye height drives projection of entities, path rails, brake line (reaction+v²/2a) and room parallax; speed raises load/heart rate → throttle tiers; overrun warning when a hostile sits inside brake distance; frame.run + imu.head_height_m streamed
- Tested: iteration_7 all pass; fixes: stray brace, run start keeps stepped distance, speed default 0, luciferic edge mask, marker cap 320 px, event log cap, overrun at full opacity, T3 chip offset

## Lure, body audio, Unreal run fields — added 2026-06
- Luciferic lure (visor + hallway): strongest luciferic entity in view pulls the reticle (hud.lure); resist = composure slider + hold Space + EEG alpha vs beta; gold edge glow + glass chip on the side opposite the target; adds to cognitive load
- Body audio (WebAudio synth, toggle + volume in both panels): footsteps per run.step (softer crouched, shuffle prone, L/R pan), breathing follows bio.breath_phase (slows to 0.1 Hz while steadying)
- Unreal kit: FG14RunData, FG14LureData, EG14Stance, IMU.HeadHeightM, Bio.BreathHz/BreathPhase, parsing, OnRunChanged/OnLureChanged, UpdateRun/UpdateLure widget events, sample JSON + README sections (not compiled in UE5)
- Tested: iteration_8 (15/15 backend, all frontend flows); chip overlap design issue fixed after

## Backlog
- P1: Spinal rig bar (MAX30102 HR/SpO2/HRV) + bio telemetry panels
- P1: Live ESP32/Teensy feed in place of simulated data
- P2: Saved presets/layouts; session record/replay; ESP32-CAM background; exportable HUD style settings for UMG
