import os
os.chdir('/app/frontend/src')
def ed(p, a, b, cnt=1):
    s=open(p).read(); assert a in s, (p,a[:80]); open(p,'w').write(s.replace(a,b,cnt))

# compose signature
ed('lib/sim.js','export function composeVisor(world, tel, rules, { bus, now }, seq) {','export function composeVisor(world, tel, c, rules, { bus, now }, seq) {')

# panels: tabs
for P, sig_old, sig_new in [
  ('components/panels/SensorPanel.jsx','export const SensorPanel = memo(({ open, onClose, controls, setControls, view, setView, activePreset, setActivePreset }) => {','export const SensorPanel = memo(({ open, onClose, controls, setControls, view, setView, activePreset, setActivePreset, telemetry }) => {\n  const [tab, setTab] = useState("controls");'),
  ('components/panels/HallwayPanel.jsx','export const HallwayPanel = memo(({ open, onClose, controls, setControls, playing, setPlaying, onReset, onZone, onRun }) => {','export const HallwayPanel = memo(({ open, onClose, controls, setControls, playing, setPlaying, onReset, onZone, onRun, telemetry }) => {\n  const [tab, setTab] = useState("controls");'),
]:
    ed(P, 'import { memo } from "react";', 'import { memo, useState } from "react";\nimport { TelemetryPanel, DrawerTabs } from "@/components/telemetry/TelemetryPanel";')
    ed(P, sig_old, sig_new)
    ed(P, '<div className="drawer-body">', '<div className="drawer-body">\n        <DrawerTabs tab={tab} setTab={setTab} />\n        {tab === "telemetry" ? <TelemetryPanel telemetry={telemetry} /> : <>')
    s=open(P).read(); i=s.rindex('      </div>\n    </aside>'); s=s[:i]+'      </>}\n      </div>\n    </aside>'+s[i+len('      </div>\n    </aside>'):]; open(P,'w').write(s)

# Visor page
V='pages/VisorPage.jsx'
ed(V,'import { DEFAULT_CONTROLS, DEFAULT_VIEW, layerOpacity, makeVisorSim } from "@/lib/sim";\nimport { useSimulation } from "@/hooks/useSimulation";','import { DEFAULT_CONTROLS, DEFAULT_VIEW, layerOpacity, makeVisorSim, composeVisor } from "@/lib/sim";\nimport { useTelemetryEngine } from "@/hooks/useTelemetryEngine";\nimport { useRules } from "@/lib/rules";\nimport { TapeDeck } from "@/components/telemetry/TapeDeck";\nimport { BootScreen } from "@/components/telemetry/BootScreen";')
ed(V,'''export default function VisorPage() {
  const [controls, setControls] = useState(DEFAULT_CONTROLS);''','''export default function VisorPage() {
  const { rules } = useRules();
  return rules ? <Visor rules={rules} /> : <BootScreen />;
}

function Visor({ rules }) {
  const [controls, setControls] = useState(DEFAULT_CONTROLS);''')
ed(V,'''  const builder = useMemo(makeVisorSim, []);
  const { frame, frameRef, streamStatus } = useSimulation(controls, streaming, builder);''','''  const sim = useMemo(makeVisorSim, []);
  const engine = useTelemetryEngine({ scene: "city", sim, compose: composeVisor, controls, setControls, rules, streaming });
  const { frame, frameRef, streamStatus } = engine;''')
ed(V,'''    <div className={`visor-root tier-${tier}`} data-testid="visor-page">''','''    <div className={`visor-root tier-${tier} ${frame.replay ? "is-replay" : ""}`} data-testid="visor-page">''')
ed(V,'''      <VisorFrame overload={tier === 2} scanlines={view.scanlines} />''','''      <VisorFrame overload={tier === 2} scanlines={view.scanlines} />
      <TapeDeck engine={engine} scene="city" />''')
ed(V,'''view={view} setView={setView} activePreset={activePreset} setActivePreset={setActivePreset} />''','''view={view} setView={setView} activePreset={activePreset} setActivePreset={setActivePreset} telemetry={frame.telemetry} />''')
ed(V,'LINK {streamStatus === "live" ? "STREAMING" : "LOCAL SIM"}','LINK {streamStatus === "live" ? "STREAMING" : "LOCAL"} {Math.round(frame.link.status * 100)}<small className="u-label">%</small>')
ed(V,'· HOLD SPACE TO STEADY · ALL SENSOR DATA SIMULATED','· HOLD SPACE TO STEADY · {frame.replay ? "REPLAYING RECORDED SESSION" : "TELEMETRY BUS · SIM SOURCES"}')

# Hallway page
H='pages/HallwayPage.jsx'
ed(H,'import { DEFAULT_CORRIDOR, ENTITY_TYPES, makeCorridorSim, CORRIDOR_LEGEND, stepCloser, ZONES, FOCUS_LIMIT, RUN } from "@/lib/corridor";','import { DEFAULT_CORRIDOR, ENTITY_TYPES, makeCorridorSim, composeCorridor, CORRIDOR_LEGEND, stepCloser, ZONES, FOCUS_LIMIT, RUN } from "@/lib/corridor";\nimport { useRules } from "@/lib/rules";\nimport { TapeDeck } from "@/components/telemetry/TapeDeck";\nimport { BootScreen } from "@/components/telemetry/BootScreen";')
ed(H,'import { useSimulation } from "@/hooks/useSimulation";','import { useTelemetryEngine } from "@/hooks/useTelemetryEngine";')
ed(H,'''export default function HallwayPage() {
  const [controls, setControls] = useState(DEFAULT_CORRIDOR);''','''export default function HallwayPage() {
  const { rules } = useRules();
  return rules ? <Hallway rules={rules} /> : <BootScreen />;
}

function Hallway({ rules }) {
  const [controls, setControls] = useState(DEFAULT_CORRIDOR);''')
ed(H,'''  const builder = useMemo(makeCorridorSim, []);
  const { frame, frameRef, streamStatus } = useSimulation(controls, streaming, builder);''','''  const sim = useMemo(makeCorridorSim, []);
  const engine = useTelemetryEngine({ scene: "hallway", sim, compose: composeCorridor, controls, setControls, rules, streaming });
  const { frame, frameRef, streamStatus } = engine;''')
ed(H,'''  const zone = ZONES[controls.zone];''','''  const zone = ZONES[frame.zone];''')
ed(H,'''${calm ? "calm-assist" : ""} lv-${level}`}''','''${calm ? "calm-assist" : ""} lv-${level} ${frame.replay ? "is-replay" : ""}`}''')
ed(H,'''scanlines hr={frame.bio.heart_rate_bpm} />''','''scanlines hr={frame.bio.heart_rate_bpm} />
      <TapeDeck engine={engine} scene="hallway" />''')
ed(H,'''onZone={onZone} onRun={onRun} />''','''onZone={onZone} onRun={onRun} telemetry={frame.telemetry} />''')
ed(H,'· ALL ENTITY DATA SIMULATED','· {frame.replay ? "REPLAYING RECORDED SESSION" : "TELEMETRY BUS · SIM SOURCES"}')

# App + nav
A='App.js'
ed(A,'import BaselinePage from "@/pages/BaselinePage";','import BaselinePage from "@/pages/BaselinePage";\nimport RulesPage from "@/pages/RulesPage";\nimport { RulesProvider } from "@/lib/rules";')
ed(A,'    <BrowserRouter>','    <RulesProvider>\n    <BrowserRouter>')
ed(A,'    </BrowserRouter>','    </BrowserRouter>\n    </RulesProvider>')
ed(A,'        <Route path="/unreal" element={<UnrealPage />} />','        <Route path="/unreal" element={<UnrealPage />} />\n        <Route path="/rules" element={<RulesPage />} />')
ed('components/TopBar.jsx','''        <Link to="/unreal" ''','''        <Link to="/rules" className={pathname === "/rules" ? "active" : ""} data-testid="nav-rules-link">RULES</Link>
        <Link to="/unreal" ''')

# unit labels + SIM tags
S='components/hud/StasisMeter.jsx'
ed(S,'import ','import { U, SimTag } from "@/components/telemetry/Units";\nimport ')
ed(S,'<span className="portrait-idx" data-testid="stasis-index-value">{Math.round(stasis_index * 100)}</span>','<span className="portrait-idx" data-testid="stasis-index-value">{Math.round(stasis_index * 100)}<U>%</U><SimTag frame={frame} ch="stasis" /></span>')
ed(S,'<span className="band-val">{Math.round(bands[b.k] * 100)}%</span>','<span className="band-val">{Math.round(bands[b.k] * 100)}<U>%</U><SimTag frame={frame} ch={`eeg_${b.k}`} /></span>')
P='components/hud/Panels.jsx'
ed(P,'import ','import { U, SimTag } from "@/components/telemetry/Units";\nimport ')
ed(P,'<b data-testid="cognitive-load-value">{Math.round(cognitive_load * 100)}</b>','<b data-testid="cognitive-load-value">{Math.round(cognitive_load * 100)}<U>%</U></b><SimTag frame={frame} ch="cog_load" />')
D='components/hud/DynamicCompass.jsx'
ed(D,'import ','import { SimTag } from "@/components/telemetry/Units";\nimport ')
ed(D,'''<b data-testid="compass-heading-value">{String(Math.round(heading) % 360).padStart(3, "0")}°</b>''','''<b data-testid="compass-heading-value">{String(Math.round(heading) % 360).padStart(3, "0")}°<SimTag frame={frame} ch={["imu_yaw", "imu_pitch", "imu_roll"]} /></b>''')
G='components/corridor/GhostHud.jsx'
ed(G,'import ','import { U, SimTag } from "@/components/telemetry/Units";\nimport ')
ed(G,'''    <div className="te-row"><span>SpO₂</span><b>{frame.bio.spo2}%</b></div>
    <div className="te-row"><span>STASIS</span><b>{Math.round(frame.eeg.stasis_index * 100)}</b></div>
    <div className="te-row"><span>COG LOAD</span><b>{Math.round(frame.hud.cognitive_load * 100)}</b></div>
    <div className="te-row"><span>FOCUS</span><b>{frame.hud.focus_ids.length}</b></div>''','''    <div className="te-row"><span>SpO₂</span><b>{frame.bio.spo2}<U>%</U><SimTag frame={frame} ch="spo2" /></b></div>
    <div className="te-row"><span>STASIS</span><b>{Math.round(frame.eeg.stasis_index * 100)}<U>%</U><SimTag frame={frame} ch="stasis" /></b></div>
    <div className="te-row"><span>COG LOAD</span><b>{Math.round(frame.hud.cognitive_load * 100)}<U>%</U><SimTag frame={frame} ch="cog_load" /></b></div>
    <div className="te-row"><span>EM · TEMP</span><b>{frame.env.em_ut}<U>µT</U> {frame.env.thermal_c.toFixed(1)}<U>°C</U><SimTag frame={frame} ch={["em_field", "temp"]} /></b></div>
    <div className="te-row"><span>FOCUS</span><b>{frame.hud.focus_ids.length}<U>TGT</U></b></div>''')
ed(G,'''        <b data-testid="heart-rate-value">{heart_rate_bpm}</b>
      </div>''','''        <b data-testid="heart-rate-value">{heart_rate_bpm}</b><U>BPM</U><SimTag frame={frame} ch="hr_bpm" />
      </div>
      <span className="vc-ring-label" data-testid="vitals-stasis-label">STASIS {Math.round(stasis_index * 100)}<U>%</U></span>''')
T='components/corridor/ThrottleHud.jsx'
ed(T,'<span>STASIS {Math.round(frame.eeg.stasis_index * 100)}</span>','<span>STASIS {Math.round(frame.eeg.stasis_index * 100)}<small className="u-label">%</small></span>')
ed(T,'<span>LOAD {load} · T{tier}</span>','<span>LOAD {load}<small className="u-label">%</small> · T{tier}</span>')
print('ok')
