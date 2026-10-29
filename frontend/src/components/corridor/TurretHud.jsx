import { toScreen } from "@/components/corridor/GhostHud";
import { U } from "@/components/telemetry/Units";

const IMG = "https://static.prod-images.emergentagent.com/jobs/e985c244-e4a3-4446-beff-f722650fda53/images/96c15432a1da9901ca80df88c809de9bfc99ec0b0dc1aacc50336917684fe02b.jpeg";
const TONE = { stowed: "idle", preview: "info", deploying: "info", active: "good", turned: "bad", down: "bad" };
const rad = (d) => (d * Math.PI) / 180;

// scene layer: ghost preview at your feet, deploy ring, acoustic cone and laser line toward the target
export const TurretScene = ({ frame }) => {
  const t = frame.turret;
  if (!t || t.status === "stowed") return null;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const imu = frame.imu;
  const origin = Math.abs(t.back_m) < 1.5 ? [W * 0.62, H * 0.9] : [W * 0.56, H * 1.04];
  const tgt = frame.scan.entities.find((e) => e.id === t.target_id);
  const d = tgt ? tgt.distance_m : Math.min(t.range_m, 20);
  const lane = tgt ? tgt.lane_m : 0;
  const half = Math.tan(rad(t.cone_deg / 2)) * (d + t.back_m);
  const [tx, ty] = toScreen([lane, 1, Math.max(1.2, d)], imu, W, H);
  const [l1x, l1y] = toScreen([lane - half, 1, Math.max(1.2, d)], imu, W, H);
  const [r1x, r1y] = toScreen([lane + half, 1, Math.max(1.2, d)], imu, W, H);
  const laser = t.ignition !== "idle";
  return (
    <svg className={`turret-scene st-${t.status}`} width="100%" height="100%" data-testid="turret-scene" data-status={t.status}>
      {(t.status === "preview" || t.status === "deploying") && (
        <g transform={`translate(${W * 0.62}, ${H * 0.86})`} className="ts-ghost" data-testid="turret-ghost-preview">
          <rect x="-26" y="-34" width="52" height="26" rx="3" /><rect x="-10" y="-8" width="20" height="14" />
          <ellipse cx="0" cy="12" rx="34" ry="9" /><path d="M-34,14 L-48,26 M34,14 L48,26 M-14,20 L-20,32 M14,20 L20,32" />
          {t.status === "deploying" && <circle r="46" className="ts-deploy" strokeDasharray={289} strokeDashoffset={289 * (t.deploy_left / t.deploy_total)} data-testid="turret-deploy-ring" />}
        </g>
      )}
      {t.tone_on && <polygon points={`${origin[0]},${origin[1]} ${l1x},${l1y} ${r1x},${r1y}`} className="ts-cone" data-testid="turret-acoustic-cone" />}
      {laser && tgt && <line x1={origin[0]} y1={origin[1]} x2={tx} y2={ty} className={`ts-laser ign-${t.ignition}`} data-testid="turret-laser-line" />}
      <ToneLock t={t} x={tx} y={ty} show={!!tgt} />
      {t.status === "turned" && <circle cx={origin[0]} cy={origin[1] - 20} r="30" className="ts-turned" />}
    </svg>
  );
};

// Tone Lock Assist: ring on the target fills as the Wolf-Tone nears its resonance band, solid when locked
const ToneLock = ({ t, x, y, show }) => {
  const TL = t.lock_rules;
  if (!show || t.status !== "active" || t.eff_mode !== "acoustic" || t.lock_band_hz == null || t.tone_lock < TL.show_from) return null;
  const locked = t.tone_lock >= TL.lock_at;
  const C = 2 * Math.PI * 22;
  const off = t.tone_hz - t.lock_band_hz;
  return (
    <g transform={`translate(${x}, ${y - 34})`} className={`ts-lock ${locked ? "locked" : ""}`} data-testid="tone-lock-ring" data-locked={locked} data-lock={t.tone_lock.toFixed(2)}>
      <circle r="22" className="tl-track" />
      <circle r="22" className="tl-fill" strokeDasharray={C} strokeDashoffset={C * (1 - t.tone_lock)} />
      <text y="36" textAnchor="middle" data-testid="tone-lock-label">{locked ? "TONE LOCK" : `${off > 0 ? "+" : ""}${off}Hz`}</text>
    </g>
  );
};

const Bar = ({ v, cls, testId }) => <i className={`tsb ${cls}`}><i style={{ width: `${Math.max(0, Math.min(100, v))}%` }} data-testid={testId} /></i>;

// status strip near the loadout; the full card appears only while you look at it (hover = gaze)
export const TurretStrip = ({ frame, onDeploy }) => {
  const t = frame.turret;
  if (!t) return null;
  const tone = TONE[t.status];
  return (
    <div className={`turret-strip tone-${tone}`} data-testid="turret-strip" data-status={t.status}>
      <span className="ts-tag" onClick={onDeploy} role="button" title="Loadout slot: click (or G) to preview, again to deploy" data-testid="turret-status-tag"><i /> G-13 {t.status.toUpperCase()}{t.status === "active" ? ` · ${t.auto ? "AUTO " : ""}${t.eff_mode === "acoustic" ? `${t.tone_hz}Hz` : "LASER"}` : ""}</span>
      <span className="ts-mini">
        <Bar v={t.battery} cls="bat" testId="turret-battery-bar" />
        <Bar v={((t.temp - 20) / 65) * 100} cls="heat" testId="turret-heat-bar" />
      </span>
      <div className="turret-card" data-testid="turret-card">
        <div className="tc-img"><img src={IMG} alt="G-13 Wolf-Trap" /></div>
        <div className="tc-rows">
          <span>BATTERY<b>{Math.round(t.battery)}<U>%</U></b></span>
          <span>TEMP<b>{t.temp.toFixed(1)}<U>°C</U></b>{t.peltier && <em>PELTIER</em>}</span>
          <span>PAN · TILT<b>{t.heading.toFixed(0)}<U>°</U> {t.tilt.toFixed(0)}<U>°</U></b></span>
          <span>TRACK CONF<b>{Math.round(t.confidence)}<U>%</U></b></span>
          <span>PULSES<b>{t.pulses}<U>left</U></b>{t.cooldown > 0 && <em>CD {t.cooldown.toFixed(0)}<U>s</U></em>}</span>
          <span>IGNITION<b className={`ign-${t.ignition}`}>{t.ignition.toUpperCase()}</b></span>
          <span>DOCK<b>{t.module_label}</b></span>
          <span>INTEGRITY<b>S{t.stage}</b>{t.shutdown_held > 0 && <em>SHUTDOWN {Math.round((t.shutdown_held / t.shutdown_need) * 100)}<U>%</U></em>}</span>
        </div>
      </div>
    </div>
  );
};

export const TurretWarning = ({ frame }) => {
  const t = frame.turret;
  if (!t?.warn) return null;
  return <div className="turret-warn" data-testid="turret-down-warning">{t.status === "turned" ? "TURRET TURNED · HOLD T" : "TURRET DOWN"}</div>;
};
