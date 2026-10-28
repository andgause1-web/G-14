# G-14 Aether Wave — Unreal Engine 5 HUD Starter Kit

Starter C++ for receiving the G-14 HUD telemetry (schema `g14.hud.v1`) and driving a UMG HUD.
Written for UE 5.3+. Not compiled or tested inside Unreal by the simulator — treat as a starting point.

## Files
- `Source/G14Hud/Public/G14HudTypes.h` — USTRUCTs/enums mirroring the JSON message
- `Source/G14Hud/Public|Private/G14TelemetryReceiver.*` — Actor that connects over WebSocket, parses frames, broadcasts events
- `Source/G14Hud/Public|Private/G14HudWidget.*` — UUserWidget base with Blueprint hooks + projection/Lissajous/Chladni helpers
- `Source/G14Hud/G14Hud.Build.cs` — module dependencies
- `Schema/g14_hud_v1.sample.json` — example frame

## Setup
1. Create (or open) a C++ project. Copy `Source/G14Hud` into your project's `Source/` folder **as a new module**,
   and add it to your `.uproject` Modules list and `*.Target.cs` `ExtraModuleNames`.
   *Alternative:* drop the files into your main game module, add the Build.cs dependencies there,
   and replace `G14HUD_API` with `YOURPROJECT_API`.
2. Regenerate project files and build.
3. Place **AG14TelemetryReceiver** in your level. Set `ServerUrl` to the subscriber URL shown on the simulator's
   Unreal Kit page (`wss://<sim-host>/api/ws/hud`).
4. Create a Widget Blueprint, set parent class to **UG14HudWidget**, and add it to the viewport (e.g. in your PlayerController).
5. Implement the events: `UpdateStasisMeter`, `UpdateCompass`, `UpdateEntities`, `UpdateTargeting`, `ApplyObserverThrottle`.
6. In the web simulator, open **Data Feed** and turn on **Stream to Unreal**. Press Play in Unreal — frames arrive ~10 Hz.

## Events (on the receiver)
| Event | Fires |
|---|---|
| OnFrameReceived | every frame |
| OnEEGChanged | every frame (ADS1299 bands) |
| OnHeadMotionChanged | when yaw/pitch/roll moves more than `HeadMotionThresholdDeg` (BMI270) |
| OnEntitiesChanged / OnScanChanged | every frame (TSL1401CL scan) |
| OnConnectionChanged | connect / disconnect (auto-reconnects) |

## Observer throttling
`hud.throttle_tier` is 0/1/2 from `hud.cognitive_load` (>=0.6 tier 1, >=0.8 tier 2).
Tier 1 fades compass + radar to 30%. Tier 2 fades them to 12% and the stasis meter to 35%.
Entities and the reticle are never throttled. Use `GetElementOpacity()` to apply this.

## Corridor scene (Hallway page)
Frames from the Hallway page add optional fields: `scene: "asylum_corridor"`, `lead_m`, and per entity
`type`, `stage`, `disposition`, `lane_m`, `countered`, plus `hud.observer_filter` and `hud.boss_observation`.
Stages by distance: >80 m DETECTED, >60 CLASSIFYING, >40 IDENTIFIED, >20 TRACKING, else PROXIMITY. The boss is always OBSERVED.
Use `Type` to pick which pre-rendered overlay mesh/material to spawn; swap to it at IDENTIFIED (the observer filter "resolve").
In the corridor the lateral screen position is `LaneM / DistanceM` (pinhole), which `ProjectEntity` already covers via the bearing.

## 3-Vector Ghost mode (cognitive-load fix)
`hud.mode` = "ghost" | "full". In ghost mode render only the entities in `hud.focus_ids` (max 3, 2 under Calm Assist),
replace text with: RED floor zone + brake line at the nearest focus threat (critical apex), BLUE glide path up the
opposite wall/ceiling (hidden under Calm Assist), YELLOW centreline "nanite stream". Use edge glows for direction and
`bio.heart_rate_bpm` (MAX30102) >= 110 to set `hud.calm_assist` (show a 4-4-4-4 box-breathing pacer, fade the rest).
Spline Mesh Components are a good fit for the three vectors in UE5.

## Observer Throttle (Hallway default mode)
`hud.cognitive_load` 0..1 → `hud.obs_tier`: T0 <0.4, T1 <0.7, T2 <0.9, T3. Each entity has `score`
(threat weight × 1/distance × approach bonus) and `approach_mps`; give the top score a full card beside the entity
with a leader line, tags for the rest, keep a centre circle (25% of view width) free of text, and fade with 300 ms
Widget Animations. `env { em_ut, thermal_c, imu_jitter_deg }` is compared against a recorded baseline (mean ± std);
flag only values beyond 4σ and ≥5%.

## Live Vector Run + body cues
`run { mode, speed_mps, eye_m, stance, brake_m, travelled_m, overrun, step }` and `imu.head_height_m` arrive while a
run is active (Hallway page). Set the camera Z to `EyeM` (stand = body height × 0.936, crouch × 0.58, prone 0.35 m),
draw two floor splines ±0.55 m from the path centre and a dashed brake line at `BrakeM` (0.3 s reaction + v²/10).
Tint cyan → amber above 4 m/s → red when `bOverrun`. `StepCount` increments once per footfall: play a footstep cue
when it changes (gain by speed, softer when crouched, shuffle when prone). `bio.breath_hz` / `bio.breath_phase`
(sin > 0 = inhale) drive breathing audio and visor fog. Bind `OnRunChanged` or implement `UpdateRun` on the widget.

## Luciferic lure
`hud.lure { target_id, pull, resist, resisting, dx_deg, dy_deg }`: the strongest luciferic entity pulls the reticle.
`resist` = composure + active steadying (hold Space in the sim) + EEG alpha vs beta; `pull` is what is left (0..1).
Offset the reticle by `dx_deg` / `dy_deg` (already scaled by pull) and show a lure warning when `pull > 0.15`.
Implement `UpdateLure` on the widget or bind `OnLureChanged`.

## G-13 Wolf-Trap turret (sim → hardware)
The browser sim publishes `turret_battery`, `turret_temp`, `turret_heading`, `turret_tilt`, `turret_confidence`,
`turret_ignition_status` (0 idle, 1 verifying, 2 verified, -1 failed, -2 snowball abort) and `turret_link` on the same bus as
the helmet. Each channel can be switched to SERIAL; when the real turret answers, its values replace the sim, and if it goes
quiet for 500 ms the HUD falls back to SIM and tags the readout. Mapping when the hardware exists:
- **Battery**: 4S LiPo through an INA226 (voltage/current). It sheds load in this order: the Peltier first, then the acoustic driver.
- **Temp / Peltier**: an NTC on the driver heatsink. The Peltier has its own on-time limit and cooldown, from `rules.turret.heat`.
- **Pan / tilt**: servo feedback plus the turret BMI270 for beam stabilisation; the heading is sent in the helmet's yaw frame.
- **Tracking confidence**: TSL1401CL line-scan SNR. The FPGA gates the laser pulse to the camera exposure; ignition is verified
  only if plasma UV is seen inside `laser.ignition_window_ms`, and the shot aborts above `laser.max_target_mps` (snowball rule).
- **Link / module**: the pogo-pin dock carries power, UART and an I²C ID EEPROM, so the helmet knows which G-12 module is docked.
- **Helmet side**: the ESP32 bridge forwards turret frames to the helmet as `{channel, value, unit, ts, source:"serial", quality}`.
  Bone-conduction cues and the Dampen toggle stay on the helmet; Unreal reads the same JSON over `/api/ws/hud`.

## Later: real hardware
Your ESP32/Teensy can publish the same JSON either by `POST /api/telemetry` or a WebSocket
to `/api/ws/hud?role=publisher`, or you can point `ServerUrl` straight at a WebSocket server on the ESP32.
`ProcessMessage(Json)` also accepts frames from any other transport (serial, UDP, file replay).
