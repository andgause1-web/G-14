import { memo, useState } from "react";
import { TelemetryPanel, DrawerTabs } from "@/components/telemetry/TelemetryPanel";
import { X, Zap, Waves, Flame } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { PRESETS } from "@/lib/sim";
import { CROSSHAIR_TYPES } from "@/components/hud/LissajousReticle";

const PRESET_BTNS = [
  { k: "calm", label: "CALM", icon: Waves },
  { k: "combat", label: "COMBAT", icon: Zap },
  { k: "overload", label: "OVERLOAD", icon: Flame },
];

const GROUPS = [
  {
    title: "EEG · ADS1299", jp: "脳波",
    rows: [["alpha", "Alpha", 0, 100], ["beta", "Beta", 0, 100], ["theta", "Theta", 0, 100], ["delta", "Delta", 0, 100], ["gamma", "Gamma", 0, 100]],
  },
  {
    title: "HEAD MOTION · BMI270", jp: "頭部運動",
    rows: [["yaw", "Yaw °", -180, 180], ["pitch", "Pitch °", -30, 30], ["roll", "Roll °", -30, 30]],
  },
  {
    title: "SCAN · TSL1401CL", jp: "スキャン",
    rows: [["entityCount", "Entities", 0, 5], ["distance", "Distance m", 5, 300], ["threat", "Threat %", 0, 100], ["resonance", "Resonance %", 0, 100], ["stability", "Stability %", 0, 100]],
  },
];

const LAYERS = [["entities", "Entity silhouettes"], ["reticle", "Lissajous targeting"], ["radar", "Cymatic radar"], ["stasis", "Stasis meter"], ["compass", "Dynamic compass"]];

export const SliderRow = ({ id, label, min, max, value, onChange }) => (
  <div className="ctl-row">
    <div className="ctl-label"><span>{label}</span><b data-testid={`slider-value-${id}`}>{value}</b></div>
    <Slider data-testid={`slider-${id}`} min={min} max={max} step={1} value={[value]} onValueChange={([v]) => onChange(id, v)} />
  </div>
);

export const ToggleRow = ({ id, label, checked, onChange }) => (
  <label className="ctl-toggle">
    <span>{label}</span>
    <Switch data-testid={`toggle-${id}`} checked={checked} onCheckedChange={onChange} />
  </label>
);

export const BodyAudioRows = ({ controls, set }) => (
  <>
    <ToggleRow id="body-audio" label="Body + possession audio (footsteps, breath, bone-conduction cues)" checked={controls.bodyAudio} onChange={(v) => set("bodyAudio", v)} />
    {controls.bodyAudio && <SliderRow id="bodyVol" label="Body audio volume %" min={0} max={100} value={controls.bodyVol} onChange={set} />}
  </>
);

export const SensorPanel = memo(({ open, onClose, controls, setControls, view, setView, activePreset, setActivePreset, telemetry }) => {
  const [tab, setTab] = useState("controls");
  const set = (k, v) => { setControls((c) => ({ ...c, [k]: v })); setActivePreset(null); };
  const applyPreset = (k) => { setControls((c) => ({ ...c, ...PRESETS[k] })); setActivePreset(k); };
  return (
    <aside className={`drawer drawer-right ${open ? "open" : ""}`} data-testid="sensor-panel">
      <div className="drawer-head">
        <div><div className="drawer-title">SENSOR SIMULATION</div><div className="jp">センサー制御</div></div>
        <button className="icon-btn" onClick={onClose} data-testid="sensor-panel-close-button"><X size={16} /></button>
      </div>
      <div className="drawer-body">
        <DrawerTabs tab={tab} setTab={setTab} />
        {tab === "telemetry" ? <TelemetryPanel telemetry={telemetry} /> : <>
        <div className="group-title">PRESETS</div>
        <div className="preset-row">
          {PRESET_BTNS.map(({ k, label, icon: Icon }) => (
            <button key={k} className={`preset-btn preset-${k} ${activePreset === k ? "active" : ""}`} onClick={() => applyPreset(k)} data-testid={`preset-${k}-button`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
        {GROUPS.map((g) => (
          <div key={g.title} className="ctl-group">
            <div className="group-title">{g.title} <span className="jp">{g.jp}</span></div>
            {g.rows.map(([id, label, min, max]) => (
              <SliderRow key={id} id={id} label={label} min={min} max={max} value={controls[id]} onChange={set} />
            ))}
            {g.title.startsWith("HEAD") && (
              <ToggleRow id="auto-sway" label="Natural head motion (breathing + drift)" checked={controls.autoSway} onChange={(v) => set("autoSway", v)} />
            )}
          </div>
        ))}
        <div className="ctl-group">
          <div className="group-title">OPERATOR · LURE <span className="jp">操作者</span></div>
          <SliderRow id="composure" label="Composure %" min={0} max={100} value={controls.composure} onChange={set} />
          <div className="hint-text">Luciferic entities pull the crosshair toward their false light. Composure, calm alpha (vs beta) and holding Space resist it.</div>
          <BodyAudioRows controls={controls} set={set} />
        </div>
        <div className="ctl-group">
          <div className="group-title">CROSSHAIR <span className="jp">照準</span></div>
          <div className="preset-row">
            {CROSSHAIR_TYPES.map((c) => (
              <button key={c} className={`preset-btn ${view.crosshair === c ? "active-cross" : ""}`}
                onClick={() => setView((s) => ({ ...s, crosshair: c }))} data-testid={`crosshair-${c}-button`}>
                {c.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="ctl-row" style={{ marginTop: 12 }}>
            <div className="ctl-label"><span>Opacity %</span><b data-testid="slider-value-crosshairOpacity">{view.crosshairOpacity}</b></div>
            <Slider data-testid="slider-crosshairOpacity" min={10} max={100} step={1} value={[view.crosshairOpacity]}
              onValueChange={([v]) => setView((s) => ({ ...s, crosshairOpacity: v }))} />
          </div>
        </div>
        <div className="ctl-group">
          <div className="group-title">HUD LAYERS <span className="jp">表示層</span></div>
          {LAYERS.map(([id, label]) => (
            <ToggleRow key={id} id={`layer-${id}`} label={label} checked={view.layers[id]}
              onChange={(v) => setView((s) => ({ ...s, layers: { ...s.layers, [id]: v } }))} />
          ))}
          <ToggleRow id="throttling" label="Observer throttling" checked={view.throttling} onChange={(v) => setView((s) => ({ ...s, throttling: v }))} />
          <ToggleRow id="scanlines" label="Visor scanlines" checked={view.scanlines} onChange={(v) => setView((s) => ({ ...s, scanlines: v }))} />
        </div>
      </>}
      </div>
    </aside>
  );
});
