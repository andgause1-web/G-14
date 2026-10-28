import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_VIEW, layerOpacity } from "@/lib/sim";
import { DEFAULT_CORRIDOR, ENTITY_TYPES, makeCorridorSim, composeCorridor, CORRIDOR_LEGEND, stepCloser, ZONES, FOCUS_LIMIT, RUN } from "@/lib/corridor";
import { useRules } from "@/lib/rules";
import { TapeDeck } from "@/components/telemetry/TapeDeck";
import { BootScreen } from "@/components/telemetry/BootScreen";
import { RunVectors, RunChip } from "@/components/corridor/RunVectors";
import { LureWrap, LureCue } from "@/components/hud/LureCue";
import { useResistKey } from "@/hooks/useResistKey";
import { useBodyAudio } from "@/hooks/useBodyAudio";
import { GhostVectors, Periphery, BreathPacer, VitalsChip, useSpatialCue, AlertPips, TelemetryEdge, GazeDot, reveal } from "@/components/corridor/GhostHud";
import { ThrottleHud } from "@/components/corridor/ThrottleHud";
import { useTelemetryEngine } from "@/hooks/useTelemetryEngine";
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

// W / ↑ = walk, +Shift = sprint, C = crouch, X = prone
function useRunKeys(active, setControls) {
  useEffect(() => {
    if (!active) return undefined;
    const keys = { w: false, shift: false };
    const push = () => setControls((c) => ({ ...c, keyRun: keys.w ? (keys.shift ? RUN.sprint : RUN.walk) : null }));
    const down = (ev) => {
      if (ev.target.tagName === "INPUT" && ev.target.type === "text") return;
      const k = ev.key.toLowerCase();
      if (k === "w" || k === "arrowup") { keys.w = true; push(); }
      else if (k === "shift") { keys.shift = true; push(); }
      else if (k === "c" && !ev.repeat) setControls((c) => ({ ...c, stance: c.stance === "crouch" ? "stand" : "crouch" }));
      else if (k === "x" && !ev.repeat) setControls((c) => ({ ...c, stance: c.stance === "prone" ? "stand" : "prone" }));
    };
    const up = (ev) => {
      const k = ev.key.toLowerCase();
      if (k === "w" || k === "arrowup") keys.w = false;
      else if (k === "shift") keys.shift = false;
      else return;
      push();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [active, setControls]);
}

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
  const { rules } = useRules();
  return rules ? <Hallway rules={rules} /> : <BootScreen />;
}

function Hallway({ rules }) {
  const [controls, setControls] = useState(DEFAULT_CORRIDOR);
  const [panel, setPanel] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const sim = useMemo(makeCorridorSim, []);
  const engine = useTelemetryEngine({ scene: "hallway", sim, compose: composeCorridor, controls, setControls, rules, streaming });
  const { frame, frameRef, streamStatus } = engine;
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
  const { pitch_deg, roll_deg, yaw_deg } = frame.imu;
  const lag = useRef({ yaw: yaw_deg, pitch: pitch_deg }).current;
  lag.yaw += (yaw_deg - lag.yaw) * 0.28;
  lag.pitch += (pitch_deg - lag.pitch) * 0.28;
  // inertial lag: helmet panels trail head motion ~100 ms, then settle
  const lagX = (lag.yaw - yaw_deg) * 9;
  const lagY = (pitch_deg - lag.pitch) * 9;
  const sway = { transform: `translate(${roll_deg * 0.8 + lagX}px, ${pitch_deg * 1.2 + lagY}px) rotate(${roll_deg * 0.08}deg)` };
  const zone = ZONES[frame.zone];
  const ghost = controls.mode === "ghost";
  const throttle = controls.mode === "throttle";
  const baseline = useMemo(() => JSON.parse(localStorage.getItem("g14.baseline") || "null"), []);
  const calm = frame.hud.calm_assist;
  const level = frame.hud.alert_level;
  const [mouseGaze, setMouseGaze] = useState(0);
  const gaze = controls.mouseGaze ? mouseGaze : controls.gaze;
  const gL = ghost ? reveal(gaze, -1) : 1;
  const gR = ghost ? reveal(gaze, 1) : 1;
  useSpatialCue(frame, controls.audio && level >= 2);
  const onMouseMove = useCallback((ev) => {
    if (controls.mouseGaze) setMouseGaze(Math.round(((ev.clientX / window.innerWidth) * 2 - 1) * 100));
  }, [controls.mouseGaze]);
  const onZone = useCallback((z) => {
    setPlaying(false);
    setControls((c) => ({ ...c, zone: z, distance: 100, resetKey: c.resetKey + 1 }));
  }, []);
  const onRun = useCallback((mode) => {
    setPlaying(false);
    setControls((c) => ({ ...c, run: mode, keyRun: null, distance: c.run !== "off" ? Math.round(frameRef.current.lead_m) : c.distance }));
  }, [frameRef]);
  useRunKeys(controls.run === "manual", setControls);
  useResistKey(setControls);
  useBodyAudio(frameRef, controls.bodyAudio, controls.bodyVol);

  return (
    <div className={`visor-root corridor-root tier-${tier} ${frame.hud.observer_filter ? "" : "raw-feed"} ${ghost ? "mode-ghost" : "mode-full"} ${calm ? "calm-assist" : ""} lv-${level} ${frame.replay ? "is-replay" : ""}`} style={{ "--zone": zone.accent }} onMouseMove={onMouseMove} data-testid="hallway-page">
      <CorridorBackground frameRef={frameRef} zone={zone} />
      {ghost && <GhostVectors frame={frame} />}
      <RunVectors frame={frame} />
      <CorridorEntityLayer frame={frame} tier={tier} />
      {ghost && <Periphery frame={frame} />}
      <div className="hud-layer" style={sway} data-testid="hud-layer">
        {throttle ? (
          <ThrottleHud frame={frame} frameRef={frameRef} events={events} gaze={gaze} baseline={baseline} view={view} />
        ) : (<>
        <div className="hud-slot slot-compass" style={{ opacity: ghost ? (level >= 3 ? 0.35 : 0.08) : op("compass") }}><DynamicCompass frame={frame} /></div>
        {ghost ? (
          <>
            <div className="hud-slot slot-vitals gaze-fade" style={{ opacity: Math.max(gL, calm ? 1 : 0) }} data-testid="slot-vitals"><VitalsChip frame={frame} /></div>
            <div className="hud-slot slot-telemetry gaze-fade curve-right" style={{ opacity: gR }} data-testid="slot-telemetry"><TelemetryEdge frame={frame} /></div>
            <GazeDot gaze={gaze} />
          </>
        ) : (
          <>
            <div className="hud-slot slot-stasis curve-left" style={{ opacity: op("stasis") }}><StasisMeter frame={frame} frameRef={frameRef} /></div>
            <div className="hud-slot slot-events curve-left"><EventLog events={events.slice(0, 3)} /></div>
          </>
        )}
        <div className="hud-slot slot-radar curve-left gaze-fade" style={{ opacity: ghost ? Math.max(gL, level >= 3 ? 0.45 : 0) : op("radar") }} data-testid="slot-radar">
          <RadarPanel frame={frame} frameRef={frameRef} maxRange={100} legend={CORRIDOR_LEGEND} />
        </div>
        <div className="hud-slot slot-reticle gaze-fade" style={{ opacity: calm ? 0.3 : ghost && level < 2 ? 0.2 : 1 }}><LureWrap frame={frame}><LissajousReticle frameRef={frameRef} crosshair={ghost && level < 2 ? "dot" : view.crosshair} opacity={view.crosshairOpacity / 100} /></LureWrap></div>
        {!ghost && <div className="hud-slot slot-target curve-right"><TargetReadout frame={frame} /><LoadoutPanel /></div>}
        {!ghost && <div className="hud-slot slot-rail curve-right"><StatusRail frame={frame} throttling /></div>}
        {ghost && level >= 2 && (
          <div className="hud-slot slot-ghost-legend" data-testid="ghost-legend">
            <span className="gl yellow">STREAM</span>{level >= 3 && <span className="gl red">APEX</span>}{level >= 3 && !calm && <span className="gl blue">GLIDE</span>}
            <span className="gl-count" data-testid="focus-count">{frame.hud.focus_ids.length}/{calm ? 2 : FOCUS_LIMIT}</span>
          </div>
        )}
        {ghost && <div className="hud-slot slot-pips"><AlertPips level={level} /></div>}
        {calm && <div className="hud-slot slot-breath"><BreathPacer /></div>}
        <div className="hud-slot slot-progress gaze-fade" style={{ opacity: ghost ? Math.max(gR, level >= 2 ? 0.5 : 0.06) : 1 }}><CorridorProgress frame={frame} interval={controls.interval} /></div>
        </>)}
        <div className="zone-badge gaze-fade" style={{ opacity: ghost ? Math.max(gL, 0.12) : throttle ? (frame.hud.obs_tier >= 1 ? 0 : 0.4) : 1 }} data-testid="zone-badge">{zone.name} <span className="jp">{zone.jp}</span></div>
        {!frame.hud.observer_filter && <div className="raw-warning" data-testid="raw-feed-warning">RAW ANOMALY FEED · OBSERVER FILTER OFFLINE</div>}
        <RunChip frame={frame} />
      </div>
      <LureCue frame={frame} tier={throttle ? frame.hud.obs_tier : tier} />
      <VisorFrame overload={tier === 2 && !calm && !throttle} critical={throttle && frame.hud.obs_tier === 3} scanlines hr={frame.bio.heart_rate_bpm} />
      <TapeDeck engine={engine} scene="hallway" />
      <TopBar onSensors={() => setPanel(panel === "controls" ? null : "controls")} onFeed={() => setPanel(panel === "feed" ? null : "feed")} streamStatus={streamStatus} sensorsLabel="CORRIDOR" />
      <div className="visor-hint">
        ASYLUM CORRIDOR · STEP <b data-testid="corridor-interval-label">{controls.interval} m</b> · {controls.run !== "off" ? <b data-testid="run-mode-label">VECTOR RUN {controls.run.toUpperCase()}{controls.run === "manual" ? " · W WALK · SHIFT SPRINT · C CROUCH · X PRONE" : ""}</b> : playing ? "AUTO-ADVANCING" : "MANUAL"} · {frame.replay ? "REPLAYING RECORDED SESSION" : "TELEMETRY BUS · SIM SOURCES"}
      </div>
      <HallwayPanel open={panel === "controls"} onClose={closePanel} controls={controls} setControls={setControls}
        playing={playing} setPlaying={setPlaying} onReset={onReset} onZone={onZone} onRun={onRun} telemetry={frame.telemetry} />
      <DataFeed open={panel === "feed"} onClose={closePanel} frame={frame} streaming={streaming} setStreaming={setStreaming} streamStatus={streamStatus} />
    </div>
  );
}
