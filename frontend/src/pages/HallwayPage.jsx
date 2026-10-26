import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_VIEW, layerOpacity } from "@/lib/sim";
import { DEFAULT_CORRIDOR, ENTITY_TYPES, makeCorridorSim, CORRIDOR_LEGEND, stepCloser } from "@/lib/corridor";
import { useSimulation } from "@/hooks/useSimulation";
import { VisorFrame } from "@/components/hud/VisorFrame";
import { CorridorBackground, CorridorEntityLayer } from "@/components/corridor/CorridorScene";
import { CorridorProgress, EventLog } from "@/components/corridor/CorridorProgress";
import { LissajousReticle } from "@/components/hud/LissajousReticle";
import { StasisMeter } from "@/components/hud/StasisMeter";
import { DynamicCompass } from "@/components/hud/DynamicCompass";
import { RadarPanel, TargetReadout, StatusRail, LoadoutPanel } from "@/components/hud/Panels";
import { HallwayPanel } from "@/components/panels/HallwayPanel";
import { DataFeed } from "@/components/panels/DataFeed";
import { TopBar } from "@/components/TopBar";

const STEP_MS = 3500;

function useEventLog(frame, interval, resetKey) {
  const [events, setEvents] = useState([]);
  const prev = useRef({ stages: {}, checkpoint: null, filter: null, seq: 0, resetKey });
  useEffect(() => {
    const p = prev.current;
    if (p.resetKey !== resetKey) {
      Object.assign(p, { stages: {}, checkpoint: null, filter: null, resetKey });
      setEvents([]);
      return;
    }
    const add = [];
    const firstPygmy = frame.scan.entities.find((e) => e.type === "pygmy")?.id;
    const cp = Math.ceil(frame.lead_m / interval - 0.02) * interval;
    if (p.checkpoint !== null && cp < p.checkpoint) add.push({ text: `CHECKPOINT ${cp} m REACHED`, tone: "info" });
    p.checkpoint = cp;
    if (p.filter !== null && p.filter !== frame.hud.observer_filter) {
      add.push({ text: frame.hud.observer_filter ? "OBSERVER FILTER ENGAGED" : "RAW FEED — FILTER OFFLINE", tone: frame.hud.observer_filter ? "info" : "alert" });
    }
    p.filter = frame.hud.observer_filter;
    frame.scan.entities.forEach((e) => {
      const key = `${e.stage}|${e.disposition}|${e.countered}`;
      const old = p.stages[e.id];
      if (old && old !== key && (e.type !== "pygmy" || e.id === firstPygmy)) {
        const T = ENTITY_TYPES[e.type];
        const note = e.countered ? ` · ${T.counterOn}` : e.type === "gnome" ? ` · ${e.disposition}` : "";
        add.push({ text: `${e.id} ${T.name} → ${e.stage}${note}`, tone: e.stage === "PROXIMITY" || e.disposition === "HOSTILE" && e.type === "gnome" ? "alert" : e.countered ? "good" : "info" });
      }
      p.stages[e.id] = key;
    });
    if (add.length) {
      setEvents((ev) => [...add.map((a) => ({ ...a, d: frame.lead_m, k: ++p.seq })).reverse(), ...ev].slice(0, 6));
    }
  }, [frame, interval, resetKey]);
  return events;
}

export default function HallwayPage() {
  const [controls, setControls] = useState(DEFAULT_CORRIDOR);
  const [panel, setPanel] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const builder = useMemo(makeCorridorSim, []);
  const { frame, frameRef, streamStatus } = useSimulation(controls, streaming, builder);
  const events = useEventLog(frame, controls.interval, controls.resetKey);
  const view = DEFAULT_VIEW;

  useEffect(() => {
    if (!playing) return undefined;
    if (controls.distance <= 0) {
      setPlaying(false);
      return undefined;
    }
    const id = setTimeout(() => setControls(stepCloser), STEP_MS);
    return () => clearTimeout(id);
  }, [playing, controls.distance]);

  const onReset = useCallback(() => {
    setPlaying(false);
    setControls((c) => ({ ...c, distance: 100, resetKey: c.resetKey + 1 }));
  }, []);
  const closePanel = useCallback(() => setPanel(null), []);

  const tier = frame.hud.throttle_tier;
  const op = (k) => layerOpacity(k, tier);
  const { pitch_deg, roll_deg } = frame.imu;
  const sway = { transform: `translate(${roll_deg * 0.8}px, ${pitch_deg * 1.2}px) rotate(${roll_deg * 0.08}deg)` };

  return (
    <div className={`visor-root corridor-root tier-${tier} ${frame.hud.observer_filter ? "" : "raw-feed"}`} data-testid="hallway-page">
      <CorridorBackground frameRef={frameRef} />
      <CorridorEntityLayer frame={frame} tier={tier} />
      <div className="hud-layer" style={sway} data-testid="hud-layer">
        <div className="hud-slot slot-compass" style={{ opacity: op("compass") }}><DynamicCompass frame={frame} /></div>
        <div className="hud-slot slot-stasis curve-left" style={{ opacity: op("stasis") }}><StasisMeter frame={frame} frameRef={frameRef} /></div>
        <div className="hud-slot slot-events curve-left"><EventLog events={events} /></div>
        <div className="hud-slot slot-radar curve-left" style={{ opacity: op("radar") }}>
          <RadarPanel frame={frame} frameRef={frameRef} maxRange={100} legend={CORRIDOR_LEGEND} />
        </div>
        <div className="hud-slot slot-reticle"><LissajousReticle frameRef={frameRef} crosshair={view.crosshair} opacity={view.crosshairOpacity / 100} /></div>
        <div className="hud-slot slot-target curve-right"><TargetReadout frame={frame} /><LoadoutPanel /></div>
        <div className="hud-slot slot-rail curve-right"><StatusRail frame={frame} throttling /></div>
        <div className="hud-slot slot-progress"><CorridorProgress frame={frame} interval={controls.interval} /></div>
        {!frame.hud.observer_filter && <div className="raw-warning" data-testid="raw-feed-warning">RAW ANOMALY FEED · OBSERVER FILTER OFFLINE</div>}
      </div>
      <VisorFrame overload={tier === 2} scanlines />
      <TopBar onSensors={() => setPanel(panel === "controls" ? null : "controls")} onFeed={() => setPanel(panel === "feed" ? null : "feed")} streamStatus={streamStatus} sensorsLabel="CORRIDOR" />
      <div className="visor-hint">
        ASYLUM CORRIDOR · STEP <b data-testid="corridor-interval-label">{controls.interval} m</b> · {playing ? "AUTO-ADVANCING" : "MANUAL"} · ALL ENTITY DATA SIMULATED
      </div>
      <HallwayPanel open={panel === "controls"} onClose={closePanel} controls={controls} setControls={setControls}
        playing={playing} setPlaying={setPlaying} onReset={onReset} />
      <DataFeed open={panel === "feed"} onClose={closePanel} frame={frame} streaming={streaming} setStreaming={setStreaming} streamStatus={streamStatus} />
    </div>
  );
}
