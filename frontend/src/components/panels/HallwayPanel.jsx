import { memo } from "react";
import { X, ChevronsDown, ChevronsUp, Play, Pause, RotateCcw } from "lucide-react";
import { SliderRow, ToggleRow } from "@/components/panels/SensorPanel";
import { ENTITY_TYPES, ZONES, stepCloser, stepBack } from "@/lib/corridor";

const MOODS = ["NEUTRAL", "SUBMITTED", "HOSTILE"];

export const HallwayPanel = memo(({ open, onClose, controls, setControls, playing, setPlaying, onReset, onZone }) => {
  const set = (k, v) => setControls((c) => ({ ...c, [k]: v }));
  return (
    <aside className={`drawer drawer-right ${open ? "open" : ""}`} data-testid="hallway-panel">
      <div className="drawer-head">
        <div><div className="drawer-title">CORRIDOR TEST</div><div className="jp">廊下試験 · ASYLUM WARD</div></div>
        <button className="icon-btn" onClick={onClose} data-testid="hallway-panel-close-button"><X size={16} /></button>
      </div>
      <div className="drawer-body">
        <div className="group-title">HUD MODE <span className="jp">表示モード</span></div>
        <div className="preset-row">
          <button className={`preset-btn ${controls.mode === "throttle" ? "active-cross" : ""}`} onClick={() => set("mode", "throttle")} data-testid="mode-throttle-button">THROTTLE</button>
          <button className={`preset-btn ${controls.mode === "ghost" ? "active-cross" : ""}`} onClick={() => set("mode", "ghost")} data-testid="mode-ghost-button">3-VECTOR</button>
          <button className={`preset-btn ${controls.mode === "full" ? "active-cross" : ""}`} onClick={() => set("mode", "full")} data-testid="mode-full-button">ANALYST</button>
        </div>
        <ToggleRow id="load-manual" label="Manual cognitive load" checked={controls.loadManual} onChange={(v) => set("loadManual", v)} />
        {controls.loadManual && <SliderRow id="load" label="Cognitive load (T0 <40 · T1 <70 · T2 <90 · T3)" min={0} max={100} value={controls.load} onChange={set} />}
        <div className="hint-text">Ghost: max 3 threats, colour vectors instead of text, edge glows for direction. Calm Assist kicks in above 110 BPM.</div>
        <ToggleRow id="audio-cues" label="Spatial audio pings (bone conduction)" checked={controls.audio} onChange={(v) => set("audio", v)} />
        <div className="hint-text">Calm by default: quiet → peripheral flash (contact) → audio + stream line (≤40 m) → full vector overlay (≤20 m).</div>

        <div className="group-title">GAZE REVEAL <span className="jp">視線</span></div>
        <SliderRow id="gaze" label="Gaze ← left · right →" min={-100} max={100} value={controls.gaze} onChange={set} />
        <ToggleRow id="mouse-gaze" label="Gaze follows mouse" checked={controls.mouseGaze} onChange={(v) => set("mouseGaze", v)} />
        <div className="hint-text">Look left for vitals + radar, right for telemetry. They fade out when you look away.</div>

        <div className="group-title">ZONE ROOM <span className="jp">区域</span></div>
        <div className="zone-grid">
          {Object.entries(ZONES).map(([k, z]) => (
            <button key={k} className={`zone-btn ${controls.zone === k ? "active" : ""}`} style={{ "--zone": z.accent }} onClick={() => onZone(k)} data-testid={`zone-${k}-button`}>
              <span className="zb-img" style={{ backgroundImage: `url(${z.img})` }} />
              <span className="zb-name">{z.short}</span>
            </button>
          ))}
        </div>

        <div className="group-title">APPROACH <span className="jp">接近</span></div>
        <div className="preset-row two">
          {[10, 20].map((i) => (
            <button key={i} className={`preset-btn ${controls.interval === i ? "active-cross" : ""}`} onClick={() => set("interval", i)} data-testid={`interval-${i}-button`}>
              EVERY {i} m
            </button>
          ))}
        </div>
        <div className="preset-row step-row">
          <button className="preset-btn" onClick={() => setControls(stepCloser)} data-testid="step-closer-button"><ChevronsDown size={14} />CLOSER</button>
          <button className={`preset-btn ${playing ? "preset-overload active" : ""}`} onClick={() => setPlaying(!playing)} data-testid="auto-advance-button">
            {playing ? <Pause size={14} /> : <Play size={14} />}{playing ? "PAUSE" : "AUTO"}
          </button>
          <button className="preset-btn" onClick={() => setControls(stepBack)} data-testid="step-back-button"><ChevronsUp size={14} />BACK</button>
        </div>
        <SliderRow id="distance" label="Lead distance m" min={0} max={100} value={controls.distance} onChange={set} />
        <button className="preset-btn full" onClick={onReset} data-testid="corridor-reset-button"><RotateCcw size={13} />RESET TO 100 m</button>

        <div className="group-title">OBSERVER FILTER <span className="jp">観測フィルター</span></div>
        <ToggleRow id="observer-filter" label="Stable overlay (pre-rendered)" checked={controls.filter} onChange={(v) => set("filter", v)} />
        <div className="hint-text">Off = raw anomaly feed. Signatures stay unresolved and cognitive load spikes.</div>

        <div className="group-title">COUNTERMEASURES <span className="jp">対抗策</span></div>
        <ToggleRow id="wolf-tone" label="Wolf-tone 528 Hz (Golems)" checked={controls.tone} onChange={(v) => set("tone", v)} />
        <ToggleRow id="thermal-loop" label="Peltier thermal loop (Wraiths)" checked={controls.thermal} onChange={(v) => set("thermal", v)} />

        <div className="group-title">GNOME DISPOSITION <span className="jp">小人の態度</span></div>
        <div className="preset-row">
          {MOODS.map((m) => (
            <button key={m} className={`preset-btn ${controls.gnomeMood === m ? (m === "HOSTILE" ? "preset-overload active" : "active-cross") : ""}`} onClick={() => set("gnomeMood", m)} data-testid={`gnome-${m.toLowerCase()}-button`}>
              {m}
            </button>
          ))}
        </div>

        <div className="group-title">OPERATOR <span className="jp">操作者</span></div>
        <SliderRow id="composure" label="Composure %" min={0} max={100} value={controls.composure} onChange={set} />
        <SliderRow id="yaw" label="Yaw °" min={-30} max={30} value={controls.yaw} onChange={set} />
        <SliderRow id="pitch" label="Pitch °" min={-15} max={15} value={controls.pitch} onChange={set} />
        <ToggleRow id="auto-sway" label="Natural head sway" checked={controls.autoSway} onChange={(v) => set("autoSway", v)} />

        <div className="group-title">ENTITIES <span className="jp">存在</span></div>
        {Object.entries(ENTITY_TYPES).map(([k, T]) => (
          <ToggleRow key={k} id={`entity-${k}`} label={<><i className="dot" style={{ background: T.color }} /> {T.name}</>} checked={controls.show[k]}
            onChange={(v) => setControls((c) => ({ ...c, show: { ...c.show, [k]: v } }))} />
        ))}
      </div>
    </aside>
  );
});
