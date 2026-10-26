import { useEffect, useRef } from "react";
import { FOV_H, FOV_V, threatLabel } from "@/lib/sim";
import { ENTITY_TYPES } from "@/lib/corridor";
import { GhostTags } from "./GhostHud";

const CAM_H = 1.6;
const HORIZON = 0.5;

export const CorridorBackground = ({ frameRef, zone }) => {
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
    <div className="world-bg-wrap" data-testid="corridor-background" data-zone={zone.short}>
      <div ref={ref} key={zone.img} className="corridor-bg" style={{ backgroundImage: `url(${zone.img})` }} />
      <div className="world-tint corridor-tint" />
      <div className="zone-tint" style={{ background: `radial-gradient(ellipse at 50% 50%, ${zone.tint}, transparent 75%)` }} />
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
  if (!frame.hud.observer_filter && e.type !== "boss") return <div className="cl-raw">UNFILTERED SIGNATURE · {Math.round(e.distance_m)} m · RAW</div>;
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
  const size = Math.min(Math.max(h, 6), H * 0.7);
  return (
    <div
      className={`cor-ent t-${e.type} st-${e.stage.toLowerCase()} ${raw ? "is-raw" : "is-filtered"} ${e.disposition === "HOSTILE" ? "is-hostile" : ""} ${frame.hud.mode === "ghost" && e.type !== "boss" && !frame.hud.focus_ids.includes(e.id) ? "is-dim" : ""}`}
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

function labelHeight(e, filter) {
  if (e.type === "boss") return 96;
  if (!filter || e.stage === "DETECTED") return 34;
  if (e.stage === "CLASSIFYING") return 56;
  const close = e.stage === "TRACKING" || e.stage === "PROXIMITY";
  let h = 50;
  if (e.stage === "IDENTIFIED") h += 26;
  if (e.countered) h += 15;
  if (e.type === "gnome") h += e.disposition === "HOSTILE" ? 28 : 15;
  else if (close && !e.countered) h += 28;
  return h;
}
const GAP = 150;

function layoutCallouts(items, W, H, filter, measured) {
  const out = [];
  ["L", "R"].forEach((side) => {
    const col = items.filter((i) => i.side === side).sort((a, b) => b.e.distance_m - a.e.distance_m || a.e.id.localeCompare(b.e.id));
    const hOf = (i) => (measured[i.e.id] ?? labelHeight(i.e, filter)) + 8;
    const total = col.reduce((s, i) => s + hOf(i), 0);
    let y = Math.max(H * 0.2, Math.min(col[0] ? col[0].ay - 24 : 0, H * 0.8 - total));
    let remaining = total;
    col.forEach((i) => {
        const top = Math.max(y, Math.min(i.ay - 24, H * 0.8 - remaining));
        remaining -= hOf(i);
        const lx = side === "R" ? Math.max(W / 2 + GAP, i.ax + i.size / 2 + 18) : Math.min(W / 2 - GAP, i.ax - i.size / 2 - 18);
        out.push({ ...i, top, lx });
        y = top + hOf(i);
      });
  });
  items.filter((i) => i.side === "T").forEach((i) => out.push({ ...i, top: i.ay - i.size * 0.55 - 96, lx: i.ax }));
  return out;
}

const Callouts = ({ items, frame, measured }) => (
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
        <div key={e.id} ref={(el) => { if (el) measured[e.id] = el.offsetHeight; }} className={`cor-label side-${side} st-${e.stage.toLowerCase()}`} style={{ ...pos, top, "--ent": T.color }} data-testid={`corridor-label-${e.id}`}>
          <div className="cl-id">{e.id}{swarm > 1 ? ` · SWARM ×${swarm}` : ""} <span className="cl-stage">{e.stage}</span></div>
          <LabelBody e={e} T={T} frame={frame} />
        </div>
      );
    })}
  </>
);

export const CorridorEntityLayer = ({ frame, tier }) => {
  const measured = useRef({});
  const ghost = frame.hud.mode === "ghost";
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
    const size = Math.min(Math.max(h, 6), H * 0.7);
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
        {ghost ? <GhostTags frame={frame} /> : <Callouts items={layoutCallouts(items, W, H, frame.hud.observer_filter, measured.current)} frame={frame} measured={measured.current} />}
      </div>
    </>
  );
};
