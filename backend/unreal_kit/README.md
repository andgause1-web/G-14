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

## Later: real hardware
Your ESP32/Teensy can publish the same JSON either by `POST /api/telemetry` or a WebSocket
to `/api/ws/hud?role=publisher`, or you can point `ServerUrl` straight at a WebSocket server on the ESP32.
`ProcessMessage(Json)` also accepts frames from any other transport (serial, UDP, file replay).
