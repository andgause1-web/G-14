import { useRef } from "react";
import { project, VISOR_TYPES } from "@/lib/sim";
import { layoutContacts, Contacts } from "@/components/corridor/ThrottleHud";

const entH = (e) => Math.min(460, Math.max(48, 9000 / (e.distance_m + 8)));

export const visorAnchor = (e, imu, W, H) => {
  const p = project(e, imu);
  return { ax: (p.x / 100) * W, ay: (p.y / 100) * H, h: entH(e), visible: p.visible };
};

const EntityMarker = ({ e, imu, W, H }) => {
  const a = visorAnchor(e, imu, W, H);
  if (!a.visible) return null;
  const T = VISOR_TYPES[e.type];
  const raw = e.stage === "DETECTED" || e.stage === "CLASSIFYING" || e.class === "UNKNOWN";
  const alert = e.disposition === "HOSTILE" && e.stage === "PROXIMITY";
  return (
    <div
      className={`v-ent cls-${e.class.toLowerCase()} st-${e.stage.toLowerCase()} ${raw ? "is-raw" : "is-filtered"} ${alert ? "is-alert" : ""}`}
      style={{ left: a.ax, top: a.ay, height: a.h, width: a.h * 0.67, "--ent": T.color, zIndex: 1000 - Math.round(e.distance_m) }}
      data-testid={`entity-marker-${e.id}`}
      data-stage={e.stage}
      data-type={e.type}
    >
      <img src={T.img} alt={T.name} className="v-ent-img" draggable={false} />
      {!raw && <><span className="br br-tl" /><span className="br br-tr" /><span className="br br-bl" /><span className="br br-br" /></>}
    </div>
  );
};

export const EntityLayer = ({ frame, tier }) => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const topRef = useRef([]);
  const { placed } = layoutContacts(frame, tier, W, H, topRef.current, { types: VISOR_TYPES, anchor: visorAnchor });
  topRef.current = placed.filter((p) => p.kind === "card").map((p) => p.e.id);
  const rot = { transform: `rotate(${-frame.imu.roll_deg}deg)` };
  return (
    <>
      <div className="entity-layer v-ent-layer" style={rot} data-testid="hud-entity-layer">
        {frame.scan.entities.map((e) => <EntityMarker key={e.id} e={e} imu={frame.imu} W={W} H={H} />)}
      </div>
      <div className="callout-layer" style={rot} data-testid="visor-contacts"><Contacts placed={placed} /></div>
    </>
  );
};
