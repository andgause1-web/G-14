import { useCallback, useEffect, useRef, useState } from "react";
import { EventLog } from "@/components/corridor/CorridorProgress";
import { DEFAULT_CONTROLS, DEFAULT_VIEW, layerOpacity } from "@/lib/sim";
import { useSimulation } from "@/hooks/useSimulation";
import { WorldBackground, VisorFrame } from "@/components/hud/VisorFrame";
import { EntityLayer } from "@/components/hud/EntityLayer";
import { LissajousReticle } from "@/components/hud/LissajousReticle";
import { StasisMeter } from "@/components/hud/StasisMeter";
import { DynamicCompass } from "@/components/hud/DynamicCompass";
import { RadarPanel, TargetReadout, StatusRail, LoadoutPanel } from "@/components/hud/Panels";
import { SensorPanel } from "@/components/panels/SensorPanel";
import { DataFeed } from "@/components/panels/DataFeed";
import { TopBar } from "@/components/TopBar";

const Layer = ({ show, op, className, children, testId }) =>
  show ? <div className={`hud-slot ${className}`} style={{ opacity: op }} data-testid={testId}>{children}</div> : null;

function useStageLog(frame) {
  const [events, setEvents] = useState([]);
  const prev = useRef({ stages: {}, k: 0 });
  useEffect(() => {
    const p = prev.current;
    const add = [];
    frame.scan.entities.forEach((e) => {
      const key = `${e.stage}|${e.class}`;
      if (p.stages[e.id] && p.stages[e.id] !== key) {
        add.push({ text: `${e.id} ${e.label} → ${e.stage}`, tone: e.stage === "PROXIMITY" ? "alert" : e.class === "LUCIFERIC" ? "good" : "info", d: e.distance_m, k: ++p.k });
      }
      p.stages[e.id] = key;
    });
    if (add.length) setEvents((ev) => [...add.reverse(), ...ev].slice(0, 6));
  }, [frame]);
  return events;
}

export default function VisorPage() {
  const [controls, setControls] = useState(DEFAULT_CONTROLS);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [activePreset, setActivePreset] = useState("calm");
  const [panel, setPanel] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const { frame, frameRef, streamStatus } = useSimulation(controls, streaming);
  const events = useStageLog(frame);

  const tier = view.throttling ? frame.hud.throttle_tier : 0;
  const L = view.layers;
  const op = (k) => layerOpacity(k, tier);
  const { pitch_deg, roll_deg } = frame.imu;
  const sway = { transform: `translate(${roll_deg * 0.8}px, ${pitch_deg * 1.2}px) rotate(${roll_deg * 0.08}deg)` };
  const closePanel = useCallback(() => setPanel(null), []);

  return (
    <div className={`visor-root tier-${tier}`} data-testid="visor-page">
      <WorldBackground frameRef={frameRef} />
      {L.entities && <EntityLayer frame={frame} tier={tier} />}
      <div className="hud-layer" style={sway} data-testid="hud-layer">
        <Layer show={L.compass} op={op("compass")} className="slot-compass" testId="slot-compass"><DynamicCompass frame={frame} /></Layer>
        <Layer show={L.stasis} op={op("stasis")} className="slot-stasis curve-left" testId="slot-stasis"><StasisMeter frame={frame} frameRef={frameRef} /></Layer>
        <Layer show={L.radar} op={op("radar")} className="slot-radar curve-left" testId="slot-radar"><RadarPanel frame={frame} frameRef={frameRef} /></Layer>
        <div className="hud-slot slot-events curve-left obs-fade" style={{ opacity: tier >= 2 ? 0 : tier === 1 ? 0.5 : 0.85 }} data-testid="visor-event-log"><EventLog events={events} /></div>
        <Layer show={L.reticle} op={op("reticle")} className="slot-reticle" testId="slot-reticle">
          <LissajousReticle frameRef={frameRef} crosshair={view.crosshair} opacity={view.crosshairOpacity / 100} />
        </Layer>
        <div className="hud-slot slot-target curve-right">
          {L.reticle && <div style={{ opacity: op("reticle") }} data-testid="slot-target"><TargetReadout frame={frame} /></div>}
          <LoadoutPanel />
        </div>
        <div className="hud-slot slot-rail curve-right"><StatusRail frame={frame} throttling={view.throttling} /></div>
        <div className="sys-line" data-testid="hud-system-line">
          G-14 // RIG v3.7 · SEQ {String(frame.seq).padStart(5, "0")} · LINK {streamStatus === "live" ? "STREAMING" : "LOCAL SIM"}
        </div>
      </div>
      <VisorFrame overload={tier === 2} scanlines={view.scanlines} />
      <TopBar onSensors={() => setPanel(panel === "sensors" ? null : "sensors")} onFeed={() => setPanel(panel === "feed" ? null : "feed")} streamStatus={streamStatus} />
      <div className="visor-hint">
        PRESET <b data-testid="active-preset-label">{activePreset ? activePreset.toUpperCase() : "CUSTOM"}</b> · ALL SENSOR DATA SIMULATED
      </div>
      <SensorPanel open={panel === "sensors"} onClose={closePanel} controls={controls} setControls={setControls}
        view={view} setView={setView} activePreset={activePreset} setActivePreset={setActivePreset} />
      <DataFeed open={panel === "feed"} onClose={closePanel} frame={frame} streaming={streaming} setStreaming={setStreaming} streamStatus={streamStatus} />
    </div>
  );
}
