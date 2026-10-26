import { useEffect, useRef } from "react";
import { FOV_H, FOV_V, threatLabel } from "@/lib/sim";
import { CORRIDOR_IMG, ENTITY_TYPES } from "@/lib/corridor";

const CAM_H = 1.6;
const HORIZON = 0.5;

export const CorridorBackground = ({ frameRef }) => {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    const loop = () => {
      const { yaw_deg, pitch_deg, roll_deg } = frameRef.current.imu;
      if (ref.current) {
        const x = (-yaw_deg * window.innerWidth) / FOV_H;
        const y = (pitch_deg * window.innerHeight) / FOV_V;
        ref.current.style.transform = `translate(${x}px, ${y}px) rotate(${-roll_deg}deg) scale(1.18)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [frameRef]);

  return (
    <div className="world-bg-wrap" data-testid="corridor-background">
      <div ref={ref} className="corridor-bg" style={{ backgroundImage: `url(${CORRIDOR_IMG})` }} />
      <div className="world-tint corridor-tint" />
      <div className="corridor-fog" />
    </div>
  );
};

function project(e, imu, W, H) {
  const T = ENTITY_TYPES[e.type];
  const f = H * 0.94;
  const x = W / 2 + (f * e.lane_m) / e.distance_m - (imu.yaw_deg * W) / FOV_H;
  const feet = H * HORIZON + (f * (CAM_H - T.float)) / e.distance_m + (imu.pitch_deg * H) / FOV_V;
  return { x, feet, h: (f * T.height) / e.distance_m };
}

const LabelBody = ({ e, T, frame }) => {
  if (e.stage === "DETECTED") return <div className="cl-raw">UNRESOLVED SIGNATURE · {Math.round(e.distance_m)} m</div>;
  if (e.stage === "CLASSIFYING") {
    const pct = Math.round(((80 - e.distance_m) / 20) * 100);
    return (
      <>
        <div className="cl-raw">CLASSIFYING… {Math.max(0, Math.min(99, pct))}%</div>
        <div className="cl-bar"><i style={{ width: `${pct}%` }} /></div>
        <div>DIST {Math.round(e.distance_m)} m</div>
      </>
    );
  }
  const close = e.stage === "TRACKING" || e.stage === "PROXIMITY";
  return (
    <>
      <div className="cl-name">{T.name} <span className="jp">{T.jp}</span></div>
      {(e.stage === "IDENTIFIED" || e.type === "boss") && <div className="cl-alias">“{T.alias}” · {T.steiner}</div>}
      <div>DIST <b>{Math.round(e.distance_m)} m</b> · {e.type === "gnome" || e.type === "boss" ? <>STATE <b className={`disp-${e.disposition.toLowerCase()}`}>{e.disposition}</b></> : <>THREAT <b className={`threat-${threatLabel(e.threat).toLowerCase()}`}>{threatLabel(e.threat)}</b></>}</div>
      {e.type === "boss" && (
        <>
          <div className="cl-bar gold"><i style={{ width: `${frame.hud.boss_observation * 100}%` }} /></div>
          <div className="cl-gold" data-testid="boss-observation">
            {frame.hud.boss_observation >= 1 ? "TRANSMUTATION READY" : `OBSERVATION ${Math.round(frame.hud.boss_observation * 100)}%`}
          </div>
        </>
      )}
      {e.type === "gnome" && <div className="cl-tactic">▸ {e.disposition === "HOSTILE" ? "TAMPERING WITH SUIT — REASSERT COMMAND" : "COMMAND AVAILABLE"}</div>}
      {e.countered && <div className="cl-counter">◆ {T.counterOn}</div>}
      {close && !e.countered && e.type !== "gnome" && <div className="cl-tactic">▸ {T.tactic}</div>}
    </>
  );
};

const CorridorEntity = ({ e, frame, W, H }) => {
  const T = ENTITY_TYPES[e.type];
  const { x, feet, h } = project(e, frame.imu, W, H);
  const raw = !frame.hud.observer_filter || e.stage === "DETECTED" || e.stage === "CLASSIFYING";
  const size = Math.max(h, 6);
  return (
    <div
      className={`cor-ent t-${e.type} st-${e.stage.toLowerCase()} ${raw ? "is-raw" : "is-filtered"} ${e.disposition === "HOSTILE" ? "is-hostile" : ""}`}
      style={{ left: x, top: feet - size, width: size, height: size, zIndex: 1000 - Math.round(e.distance_m * 5), "--ent": T.color }}
      data-testid={`corridor-entity-${e.id}`}
      data-stage={e.stage}
    >
      <img src={T.img} alt={T.name} className="cor-img" draggable={false} />
      {h < 14 && <span className="cor-blip" />}
      {!raw && <><span className="br br-tl" /><span className="br br-tr" /><span className="br br-bl" /><span className="br br-br" /></>}
    </div>
  );
};

const LABEL_H = { DETECTED: 34, CLASSIFYING: 56, IDENTIFIED: 74, TRACKING: 70, PROXIMITY: 70, OBSERVED: 96 };
const GAP = 150;

function layoutCallouts(items, W, H) {
  const out = [];
  ["L", "R"].forEach((side) => {
    let y = H * 0.22;
    items
      .filter((i) => i.side === side)
      .sort((a, b) => a.ay - b.ay)
      .forEach((i) => {
        const top = Math.max(y, i.ay - 24);
        const lx = side === "R" ? Math.max(W / 2 + GAP, i.ax + i.size / 2 + 18) : Math.min(W / 2 - GAP, i.ax - i.size / 2 - 18);
        out.push({ ...i, top, lx });
        y = top + LABEL_H[i.e.stage] + 10;
      });
  });
  items.filter((i) => i.side === "T").forEach((i) => out.push({ ...i, top: i.ay - i.size * 0.55 - LABEL_H.OBSERVED, lx: i.ax }));
  return out;
}

const Callouts = ({ items, frame }) => (
  <>
    <svg className="callout-lines" width="100%" height="100%">
      {items.filter((i) => i.side !== "T").map((i) => (
        <polyline key={i.e.id} points={`${i.ax},${i.ay} ${i.lx + (i.side === "R" ? -10 : 10)},${i.top + 9} ${i.lx},${i.top + 9}`} style={{ stroke: ENTITY_TYPES[i.e.type].color }} />
      ))}
    </svg>
    {items.map(({ e, side, top, lx, swarm }) => {
      const T = ENTITY_TYPES[e.type];
      const pos = side === "R" ? { left: lx } : side === "L" ? { right: window.innerWidth - lx } : { left: lx, transform: "translateX(-50%)" };
      return (
        <div key={e.id} className={`cor-label side-${side} st-${e.stage.toLowerCase()}`} style={{ ...pos, top, "--ent": T.color }} data-testid={`corridor-label-${e.id}`}>
          <div className="cl-id">{e.id}{swarm > 1 ? ` · SWARM ×${swarm}` : ""} <span className="cl-stage">{e.stage}</span></div>
          <LabelBody e={e} T={T} frame={frame} />
        </div>
      );
    })}
  </>
);

export const CorridorEntityLayer = ({ frame, tier }) => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const ents = frame.scan.entities;
  const swarm = ents.filter((e) => e.type === "pygmy").length;
  const firstPygmy = ents.find((e) => e.type === "pygmy")?.id;
  const labelled = ents.filter((e) => {
    if (e.type === "pygmy" && e.id !== firstPygmy) return false;
    return !(tier >= 2 && e.threat < 0.4 && e.type !== "boss");
  });
  const items = labelled.map((e) => {
    const { x, feet, h } = project(e, frame.imu, W, H);
    const size = Math.max(h, 6);
    const side = e.type === "boss" ? "T" : e.lane_m < 0 ? "L" : "R";
    return { e, ax: x, ay: feet - size * 0.55, size, side, swarm: e.id === firstPygmy ? swarm : 0 };
  });
  const rot = { transform: `rotate(${-frame.imu.roll_deg}deg)` };
  return (
    <>
      <div className="entity-layer" style={rot} data-testid="corridor-entity-layer">
        {ents.map((e) => <CorridorEntity key={e.id} e={e} frame={frame} W={W} H={H} />)}
      </div>
      <div className="callout-layer" style={rot} data-testid="corridor-callout-layer">
        <Callouts items={layoutCallouts(items, W, H)} frame={frame} />
      </div>
    </>
  );
};
