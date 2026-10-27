import { useRef } from "react";
import { Link } from "react-router-dom";
import { ENTITY_TYPES } from "@/lib/corridor";
import { clamp, threatLabel } from "@/lib/sim";
import { toScreen, reveal, VitalsChip, TelemetryEdge } from "./GhostHud";
import { DynamicCompass } from "@/components/hud/DynamicCompass";
import { RadarPanel, LoadoutPanel } from "@/components/hud/Panels";
import { StasisMeter } from "@/components/hud/StasisMeter";
import { LissajousReticle } from "@/components/hud/LissajousReticle";
import { EventLog } from "./CorridorProgress";
import { CORRIDOR_LEGEND } from "@/lib/corridor";

const CARD = { w: 184, h: 58 };
const TAG = { w: 58, h: 20 };
const tone = (t) => (t >= 0.7 ? "#ff2a4b" : t >= 0.4 ? "#ffaa00" : "#00ff9d");
const overlap = (a, b) => a.lx < b.lx + b.w && a.lx + a.w > b.lx && a.ly < b.ly + b.h && a.ly + a.h > b.ly;

export const clearRadius = (W) => W * 0.125;

function hitsClear(box, cx, cy, R) {
  const nx = clamp(cx, box.lx, box.lx + box.w);
  const ny = clamp(cy, box.ly, box.ly + box.h);
  return (nx - cx) ** 2 + (ny - cy) ** 2 < (R + 16) ** 2;
}

const corridorAnchor = (e, imu, W, H, T) => {
  const [ax, feet] = toScreen([e.lane_m, T.float, e.distance_m], imu, W, H);
  const h = Math.min(Math.max((H * 0.94 * T.height) / e.distance_m, 6), H * 0.7);
  return { ax, ay: feet - h * 0.6, h };
};

export function layoutContacts(frame, tier, W, H, prevTop = [], { types = ENTITY_TYPES, anchor = corridorAnchor } = {}) {
  const cx = W / 2;
  const cy = H / 2;
  const R = clearRadius(W);
  const ranked = frame.scan.entities.filter((e) => e.stage !== "DETECTED" && e.type !== "boss").sort((a, b) => b.score - a.score);
  // hysteresis: keep the current top contact(s) unless clearly outscored (>20%)
  const best = ranked[0]?.score || 0;
  const sticky = ranked.filter((e) => prevTop.includes(e.id) && e.score >= best * 0.8);
  ranked.splice(0, ranked.length, ...sticky, ...ranked.filter((e) => !sticky.includes(e)));
  const nearest = ranked.filter((e) => e.disposition === "HOSTILE").sort((a, b) => a.distance_m - b.distance_m)[0];
  const list = tier === 3 ? (nearest ? [nearest] : []) : tier === 2 ? ranked.slice(0, 1) : ranked;
  const maxCards = tier === 0 ? 2 : tier === 1 ? 1 : 0;
  const placed = [];
  const regions = {};
  list.forEach((e, i) => {
    const T = types[e.type];
    const { ax, ay, h, visible = true } = anchor(e, frame.imu, W, H, T);
    if (!visible) return;
    const side = ax < cx ? -1 : 1;
    const place = (k) => {
      const s = k === "card" ? { ...CARD, h: CARD.h + (e.false_light != null ? 12 : 0) } : TAG;
      const box = { lx: side > 0 ? ax + h * 0.3 + 14 : ax - h * 0.3 - 14 - s.w, ly: ay - s.h / 2, w: s.w, h: s.h };
      for (let g = 0; g < 60 && hitsClear(box, cx, cy, R); g++) box.lx += side * 10;
      return box;
    };
    let kind = i < maxCards ? "card" : "tag";
    let box = place(kind);
    if (kind === "card" && placed.some((p) => overlap(p, box))) {
      kind = "tag";
      box = place("tag");
    }
    for (let g = 0; g < 12 && placed.some((p) => overlap(p, box)); g++) {
      box.ly -= TAG.h + 4;
      for (let k = 0; k < 60 && hitsClear(box, cx, cy, R); k++) box.lx += side * 10;
    }
    if (placed.some((p) => overlap(p, box)) || hitsClear(box, cx, cy, R)) return;
    const reg = `${Math.floor((box.lx + box.w / 2) / (W / 3))}:${Math.floor((box.ly + box.h / 2) / (H / 3))}`;
    regions[reg] = (regions[reg] || 0) + 1;
    if (regions[reg] > 3) return;
    placed.push({ ...box, e, T, kind, ax, ay });
  });
  return { placed, nearest };
}

const Card = ({ p }) => (
  <div className="obs-card" style={{ left: p.lx, top: p.ly, width: p.w, "--ent": p.T.color, "--tone": tone(p.e.threat) }} data-testid={`obs-card-${p.e.id}`}>
    <div className="oc-top"><span>{p.e.id} · {p.e.label ?? p.T.name}</span><span>{p.e.stage}</span></div>
    <div className="oc-row">
      <b>{Math.round(p.e.distance_m)} m</b> · <b className="oc-threat">{p.e.disposition === "HOSTILE" ? threatLabel(p.e.threat) : p.e.disposition}</b>
      {p.e.approach_mps > 0.5 && <> · ▼{p.e.approach_mps} m/s</>}
    </div>
    {p.e.false_light != null && <div className="oc-fl" data-testid={`obs-card-falselight-${p.e.id}`}>FALSE LIGHT DAMPENER {Math.round(p.e.false_light * 100)}%</div>}
    <div className="oc-tac">{p.e.countered ? `◆ ${p.T.counterOn}` : p.e.class === "UNKNOWN" ? "RESOLVING — hold observation" : p.T.tactic}</div>
  </div>
);

const Tag = ({ p }) => (
  <div className="obs-tag" style={{ left: p.lx, top: p.ly, "--ent": p.T.color, "--tone": tone(p.e.threat) }} data-testid={`obs-tag-${p.e.id}`}>
    <i /> {Math.round(p.e.distance_m)}
  </div>
);

export const Contacts = ({ placed }) => (
  <>
    <svg className="obs-lines" width="100%" height="100%">
      {placed.map((p) => (
        <line key={p.e.id} x1={p.ax} y1={p.ay} x2={p.lx < p.ax ? p.lx + p.w : p.lx} y2={p.ly + p.h / 2} style={{ stroke: tone(p.e.threat) }} />
      ))}
    </svg>
    {placed.map((p) => (p.kind === "card" ? <Card key={p.e.id} p={p} /> : <Tag key={p.e.id} p={p} />))}
  </>
);

const DirectionArrow = ({ target, W, H }) => {
  if (!target) return null;
  const ang = Math.atan2(target.ay - H / 2, target.ax - W / 2);
  const R = clearRadius(W) + 22;
  return (
    <i className="obs-arrow" data-testid="obs-direction-arrow"
      style={{ left: W / 2 + Math.cos(ang) * R, top: H / 2 + Math.sin(ang) * R, transform: `translate(-50%,-50%) rotate(${ang}rad)` }} />
  );
};

export function baselineDeviation(env, baseline) {
  if (!baseline) return null;
  const ch = [["EM", env.em_ut, baseline.em], ["THERMAL", env.thermal_c, baseline.thermal], ["IMU", env.imu_jitter_deg, baseline.imu]];
  const devs = ch.map(([k, v, b]) => [k, (Math.abs(v - b.mean) / Math.max(Math.abs(b.mean), 1e-3)) * 100, v - b.mean, Math.abs(v - b.mean) / Math.max(b.std, 1e-3)]);
  return devs.sort((a, b) => b[1] - a[1]);
}

const BaselineChip = ({ env, baseline }) => {
  const devs = baselineDeviation(env, baseline);
  if (!devs) return <Link to="/baseline" className="baseline-chip none" data-testid="baseline-indicator">NO BASELINE · CALIBRATE</Link>;
  // flag only real deviations: beyond 4 sigma of the recorded noise AND at least 5%
  const flagged = devs.filter((d) => d[3] >= 4 && d[1] >= 5);
  if (!flagged.length) return <div className="baseline-chip ok" data-testid="baseline-indicator">BASELINE STABLE</div>;
  return (
    <div className="baseline-chip dev" data-testid="baseline-indicator">
      {flagged.slice(0, 2).map(([k, pct, sign]) => <span key={k}>{k} DEVIATION {sign >= 0 ? "+" : "−"}{Math.round(pct)}%</span>)}
    </div>
  );
};

const F = ({ o, className, children, testId, style }) => (
  <div className={`hud-slot obs-fade ${className}`} style={{ opacity: o, pointerEvents: o < 0.05 ? "none" : "auto", ...style }} data-testid={testId}>{children}</div>
);

export const ThrottleHud = ({ frame, frameRef, events, gaze, baseline, view }) => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const tier = frame.hud.obs_tier;
  const load = Math.round(frame.hud.cognitive_load * 100);
  const gL = reveal(gaze, -1);
  const gR = reveal(gaze, 1);
  const base = (g) => (tier === 0 ? Math.max(0.4, g) : 0.85);
  const drift = frame.eeg.state !== "STABLE" || frame.eeg.stasis_index < 0.6;
  const topRef = useRef([]);
  const { placed, nearest } = layoutContacts(frame, tier, W, H, topRef.current);
  topRef.current = placed.filter((p) => p.kind === "card").map((p) => p.e.id);
  const target = tier === 3 ? placed[0] : null;
  return (
    <div className={`obs-hud obs-t${tier}`} data-testid="observer-throttle-hud" data-tier={tier}>
      <div className="obs-contacts" data-testid="obs-contacts"><Contacts placed={placed} /></div>
      <i className="obs-clear-zone" style={{ width: clearRadius(W) * 2, height: clearRadius(W) * 2 }} data-testid="obs-clear-zone" />
      {tier === 3 && <DirectionArrow target={target || (nearest && { ax: W / 2, ay: H / 2 })} W={W} H={H} />}
      <F o={tier < 3 ? base(0) : 0} className="slot-compass" testId="obs-compass"><DynamicCompass frame={frame} /></F>
      <F o={tier < 3 ? base(0) : 0} className="slot-baseline" testId="obs-baseline"><BaselineChip env={frame.env} baseline={baseline} /></F>
      <F o={tier === 0 ? Math.max(drift ? 1 : 0.25, gL) : 0} className="slot-stasis curve-left" testId="obs-stasis"><StasisMeter frame={frame} frameRef={frameRef} /></F>
      <F o={tier === 1 ? Math.max(drift ? 1 : 0.5, gL) : 0} className="slot-stasis-strip" testId="obs-stasis-strip">
        <div className={`stasis-strip state-${frame.eeg.state.toLowerCase()}`}><i style={{ width: `${frame.eeg.stasis_index * 100}%` }} /><span>STASIS {Math.round(frame.eeg.stasis_index * 100)}</span></div>
      </F>
      <F o={tier >= 1 ? 1 : base(gL)} className="slot-vitals" testId="obs-vitals"><VitalsChip frame={frame} /></F>
      <F o={tier <= 1 ? base(gL) : 0} className="slot-events curve-left" style={{ transform: tier >= 2 ? "translateX(-140%)" : "none" }} testId="obs-event-log"><EventLog events={events} /></F>
      <F o={tier === 2 ? 0.9 : 0} className="slot-ticker" testId="obs-ticker">{events[0] ? `${Math.round(events[0].d)}m · ${events[0].text}` : "NO EVENTS"}</F>
      <F o={tier <= 1 ? base(gL) : tier === 2 ? 0.8 : 0} className={`slot-radar curve-left ${tier === 2 ? "radar-dot" : ""}`} testId="obs-radar">
        <RadarPanel frame={frame} frameRef={frameRef} maxRange={100} legend={CORRIDOR_LEGEND} />
      </F>
      <F o={tier === 0 ? base(gR) : 0} className="slot-target curve-right" testId="obs-loadout"><LoadoutPanel /></F>
      <F o={tier <= 1 ? Math.max(0.04, gR) : 0} className="slot-telemetry curve-right" testId="obs-telemetry"><TelemetryEdge frame={frame} /></F>
      <F o={tier < 3 ? 1 : 0} className="slot-reticle" testId="obs-reticle"><LissajousReticle frameRef={frameRef} crosshair={view.crosshair} opacity={view.crosshairOpacity / 100} /></F>
      <F o={tier < 3 ? 0.6 : 0} className="slot-pips" testId="obs-load">
        <div className="obs-load">{[0, 1, 2, 3].map((t) => <i key={t} className={t <= tier ? `on t${tier}` : ""} />)}<span>LOAD {load} · T{tier}</span></div>
      </F>
    </div>
  );
};
