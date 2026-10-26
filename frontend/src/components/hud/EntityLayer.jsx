import { project, threatLabel } from "@/lib/sim";

const BASE = [
  "M50,30 L50,38", "M28,42 L72,42", "M30,42 L38,92 L62,92 L70,42", "M50,38 L50,92",
  "M36,56 L64,56", "M37,70 L63,70", "M28,42 L18,70 L14,100", "M72,42 L82,70 L86,100",
  "M40,92 L36,126 L33,158", "M60,92 L64,126 L67,158", "M38,92 L50,100 L62,92",
];
const AHRI = [
  "M28,42 L14,24 L30,36", "M72,42 L86,24 L70,36", "M43,12 L36,0", "M57,12 L64,0",
  "M14,100 L8,110 M14,100 L14,112 M14,100 L20,110", "M86,100 L80,110 M86,100 L86,112 M86,100 L92,110",
  "M18,70 L8,64", "M82,70 L92,64", "M36,126 L26,124", "M64,126 L74,124",
];
const LUCI = [
  "M44,44 Q16,0 -18,20 Q2,36 -12,62 Q14,52 34,62", "M56,44 Q84,0 118,20 Q98,36 112,62 Q86,52 66,62",
  "M30,26 Q10,22 -6,40", "M70,26 Q90,22 106,40",
];

const STYLE = {
  AHRIMANIC: { color: "#ff2a4b", extra: AHRI, opacity: 1 },
  LUCIFERIC: { color: "#7ef3ff", extra: LUCI, opacity: 0.55 },
  UNKNOWN: { color: "#c9f6ff", extra: [], opacity: 0.85 },
};

const Silhouette = ({ cls }) => {
  const s = STYLE[cls];
  return (
    <svg viewBox="-20 -6 140 170" className={`entity-svg entity-${cls.toLowerCase()}`} style={{ color: s.color, opacity: s.opacity }}>
      {cls === "LUCIFERIC" && <ellipse cx="50" cy="4" rx="16" ry="4" className="ent-line" />}
      <circle cx="50" cy="20" r="10" className="ent-line" />
      {[...BASE, ...s.extra].map((d) => (
        <path key={d} d={d} className="ent-line" />
      ))}
    </svg>
  );
};

const EntityMarker = ({ e, imu, dimLabel }) => {
  const p = project(e, imu);
  if (!p.visible) return null;
  const h = Math.min(380, Math.max(56, 6000 / (e.distance_m + 6)));
  const hostile = e.class === "AHRIMANIC" && e.threat >= 0.6;
  const showLabel = !(dimLabel && e.threat < 0.4);
  return (
    <div
      className={`entity-marker cls-${e.class.toLowerCase()}`}
      style={{ left: `${p.x}%`, top: `${p.y}%`, height: h, width: h * 0.62 }}
      data-testid={`entity-marker-${e.id}`}
    >
      <Silhouette cls={e.class} />
      <span className="br br-tl" /><span className="br br-tr" /><span className="br br-bl" /><span className="br br-br" />
      {showLabel && (
        <div className="entity-label" data-testid={`entity-label-${e.id}`}>
          {hostile && <div className="ent-hostile">HOSTILE ENTITY <span className="jp">敵性体</span></div>}
          <div>{e.id} · CLASS: <b>{e.class}</b></div>
          <div>DISTANCE: <b>{Math.round(e.distance_m)} m</b></div>
          <div>THREAT: <b className={`threat-${threatLabel(e.threat).toLowerCase()}`}>{threatLabel(e.threat)}</b></div>
        </div>
      )}
    </div>
  );
};

export const EntityLayer = ({ frame, tier }) => (
  <div className="entity-layer" style={{ transform: `rotate(${-frame.imu.roll_deg}deg)` }} data-testid="hud-entity-layer">
    {frame.scan.entities.map((e) => (
      <EntityMarker key={e.id} e={e} imu={frame.imu} dimLabel={tier >= 1} />
    ))}
  </div>
);
