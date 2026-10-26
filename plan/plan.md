# G-14 Aether Wave — HUD Visor Simulator

A browser mockup of the G-14 helmet HUD, viewed first-person through the visor and driven by simulated sensor data you can adjust live.
It also hands over a shared data format and an Unreal Engine 5 C++ starter, so the same HUD can be rebuilt in Unreal.

## Who it's for
The helmet builder (you), to see how the HUD looks and behaves before the Unreal test, and to have working starter code ready for the Unreal side.

## Core features and experience
- **Through-the-visor view**: a first-person scene (dark cityscape) framed by the visor edge, with the HUD layered on top in the red/cyan dual-spectrum style from your infographics. Subtle scanlines, glow and slight visor curvature.
- **Entity silhouette tracking**: wireframe silhouettes of entities in the scene with corner brackets, class (e.g. Ahrimanic / Luciferic / Unknown), distance and threat level. Hostile entities render red and sharp; Luciferic ones render as dampened, semi-transparent cyan, matching the "filter" ideas in your sheet.
- **Cymatic radar**: a circular radar showing animated Chladni-style resonance patterns, with entity blips placed by direction and distance.
- **Lissajous targeting**: a target-lock reticle built from Lissajous curves that grows more complex as resonance rises, with Resonance / Stability / Threat readouts. Locking resolves into a Metatron's Cube "reality-stable zone" symbol when stability is high.
- **Stasis meter (EEG)**: brain icon plus Alpha / Beta / Theta / Delta band bars, a live waveform and a "Consciousness stable / unstable" state.
- **Dynamic compass (head motion)**: heading strip and compass rose that turn with simulated head yaw/pitch/roll; the HUD sways slightly with head motion.
- **Sensor control panel**: a side drawer with sliders and toggles for every simulated reading (EEG bands, head yaw/pitch/roll, entity count, distance, threat, resonance, stability), plus presets: Calm, Combat, Overload. Moving a slider updates the HUD instantly.
- **Observer throttling**: when "cognitive load" is high, low-priority HUD elements fade back so the view never gets cluttered (the "lazy rendering" idea from your sheet).
- **Live data feed view**: a panel showing the exact message the HUD is reading each moment, in the shared format Unreal will use.
- **Unreal starter code page**: viewable and copyable/downloadable files:
  - The shared message format (field names, units, value ranges), mapped to your parts: ADS1299 (EEG), BMI270 (IMU), TSL1401CL (scan), plus entity data.
  - A UE5 C++ receiver actor that listens for these messages and broadcasts events (e.g. OnEEGChanged, OnHeadMotionChanged, OnEntitiesChanged).
  - A C++ HUD widget base class outline with hooks for the four HUD elements, ready to style in UMG.
  - The mockup can also stream its simulated messages out, so the Unreal receiver can be tested against it before the helmet is wired.

## User flow
1. Open the app and land straight in the visor view with the HUD running on the Calm preset.
2. Open the sensor panel, drag sliders or pick Combat / Overload, and watch each HUD element react.
3. Toggle individual HUD elements on/off to compare layouts.
4. Open the data feed to see the live message, then the Unreal page to copy or download the starter code.

## UI/UX feel
Dark, cinematic and diegetic — true to the G-14 infographics: near-black backgrounds, cyan holographic lines, red alert accents, gold for the stable-zone geometry, thin technical type with small Japanese sub-labels. Smooth, continuous animation; nothing static.

## Implementation phases
**Phase 1 — MVP (built now)**
- Through-visor scene with the four chosen HUD elements (entity tracking, cymatic radar + Lissajous targeting, stasis meter, dynamic compass), observer throttling, sensor panel with presets, live data feed, and the Unreal starter code page.

**Phase 2**
- Spinal rig bar (heart rate, SpO2, HRV from the MAX30102 board) and the biological telemetry panels.
- Option to feed real readings from the ESP32/Teensy over Wi-Fi in place of the simulated ones.
- Save and name your own presets and HUD layouts.

**Phase 3**
- Record and replay sensor sessions to test the HUD against real captured data.
- Use the ESP32-CAM live video as the background in place of the stock scene.
- Exportable HUD style settings (colours, sizes, positions) that the Unreal widget reads directly.

## Assumptions
- All sensor data is simulated; no hardware connection in phase 1.
- The spinal rig bar (heart rate/SpO2) was not selected, so it is left for phase 2.
- No login; it's a personal single-user tool.
- The background scene is a stock or generated sci-fi cityscape image with light parallax, not a full 3D world.
- Entity silhouettes are stylised wireframe figures, not real detection — positions and types come from the sliders.
- Unreal code targets UE5 C++, receiving JSON messages over a local network connection; it is a starting point to compile and extend, not tested inside Unreal by us.
- The uploaded JSON files and parts list are used only for naming sensors and fields in the data format.
