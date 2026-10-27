import { toScreen } from "./GhostHud";

const pts = (arr, imu, W, H) => arr.map((p, i) => `${i ? "L" : "M"}${toScreen(p, imu, W, H).map((v) => v.toFixed(1)).join(",")}`).join(" ");
const RAIL = 0.55;

// path centre weaves away from the nearest hostile inside 25 m
function pathCentre(frame) {
  const near = frame.scan.entities
    .filter((e) => e.disposition === "HOSTILE" && e.type !== "boss" && e.distance_m < 25)
    .sort((a, b) => a.distance_m - b.distance_m)[0];
  if (!near) return () => 0;
  const off = (near.lane_m >= 0 ? -1 : 1) * 0.6;
  return (z) => off * Math.sin(Math.min(1, z / Math.max(2, near.distance_m)) * Math.PI * 0.5);
}

export const RunVectors = ({ frame }) => {
  const { run, imu, hud } = frame;
  if (!run || run.mode === "off") return null;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const tier = hud.obs_tier;
  const zEnd = Math.max(4, Math.min(frame.lead_m + 2, 60));
  const cx = pathCentre(frame);
  const zs = Array.from({ length: 18 }, (_, i) => 1.4 + ((zEnd - 1.4) * i) / 17);
  const rail = (s) => pts(zs.map((z) => [cx(z) + s * RAIL, 0, z]), imu, W, H);
  const off = run.travelled_m % 2;
  const ticks = Array.from({ length: Math.floor(zEnd / 2) }, (_, i) => 2 + i * 2 - off).filter((z) => z > 1.4 && z < zEnd);
  const bz = Math.max(1.6, run.brake_m);
  const tone = run.overrun ? "red" : run.speed_mps > 4 ? "amber" : "cyan";
  return (
    <svg className={`run-vectors run-t${tier} tone-${tone}`} width="100%" height="100%" style={{ transform: `rotate(${-imu.roll_deg}deg)` }} data-testid="run-vectors" data-tone={tone}>
      {tier < 3 && <path d={rail(-1)} className="rv-rail" data-testid="run-rail-left" />}
      {tier < 3 && <path d={rail(1)} className="rv-rail" data-testid="run-rail-right" />}
      {tier < 2 && ticks.map((z) => <path key={z.toFixed(2)} d={pts([[cx(z) - RAIL, 0, z], [cx(z) + RAIL, 0, z]], imu, W, H)} className="rv-tick" />)}
      {run.speed_mps > 0.3 && <path d={pts([[cx(bz) - RAIL * 1.6, 0, bz], [cx(bz) + RAIL * 1.6, 0, bz]], imu, W, H)} className="rv-brake" data-testid="run-brake-line" />}
    </svg>
  );
};

const GAIT = (v) => (v < 0.2 ? "HOLD" : v < 2 ? "WALK" : v < 4.5 ? "JOG" : "SPRINT");

export const RunChip = ({ frame }) => {
  const { run, hud } = frame;
  if (!run || run.mode === "off") return null;
  const tier = hud.obs_tier;
  return (
    <div className={`run-chip obs-fade ${run.overrun ? "overrun" : ""}`} style={{ opacity: tier === 3 ? 0.5 : 0.85 }} data-testid="run-chip">
      <b data-testid="run-speed">{run.speed_mps.toFixed(1)}</b><span>m/s · {GAIT(run.speed_mps)}</span>
      <i className="run-bar"><i style={{ width: `${Math.min(100, (run.speed_mps / 7) * 100)}%` }} /></i>
      {tier < 3 && (
        <span data-testid="run-details">
          {run.stance.toUpperCase()} {run.eye_m.toFixed(2)} m · BRAKE {run.brake_m} m · {Math.round(run.travelled_m)} m RUN{run.mode === "auto" ? " · AUTO" : ""}
        </span>
      )}
      {run.overrun && <span className="run-warn" data-testid="run-overrun">OVERRUN — CONTACT INSIDE BRAKE</span>}
    </div>
  );
};
