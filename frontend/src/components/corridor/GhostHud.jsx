import { useEffect, useRef } from "react";
import { Heart } from "lucide-react";
import { FOV_H, FOV_V, clamp } from "@/lib/sim";
import { ENTITY_TYPES } from "@/lib/corridor";

const CAM_H = 1.6;

function toScreen([x, y, z], imu, W, H) {
  const f = H * 0.94;
  return [
    W / 2 + (f * x) / z - (imu.yaw_deg * W) / FOV_H,
    H * 0.5 + (f * (CAM_H - y)) / z + (imu.pitch_deg * H) / FOV_V,
  ];
}

const path = (pts, imu, W, H) => pts.map((p, i) => `${i ? "L" : "M"}${toScreen(p, imu, W, H).map((v) => v.toFixed(1)).join(",")}`).join(" ");

const focusEntities = (frame) => frame.scan.entities.filter((e) => frame.hud.focus_ids.includes(e.id));

export const GhostVectors = ({ frame }) => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const { imu, hud } = frame;
  const focus = focusEntities(frame);
  const n = focus.reduce((m, e) => (!m || e.distance_m < m.distance_m ? e : m), null);
  const away = n ? (n.lane_m >= 0 ? -1 : 1) : 0;
  const zEnd = n ? Math.max(4, n.distance_m - 3) : 45;
  const yellow = Array.from({ length: 16 }, (_, i) => {
    const z = 2.5 + ((zEnd - 2.5) * i) / 15;
    return [away * 0.45 * Math.sin((Math.PI / 2) * (i / 15)), 0, z];
  });
  const red = n && [
    [n.lane_m - 1.2, 0, Math.max(3, n.distance_m - 4)], [n.lane_m + 1.2, 0, Math.max(3, n.distance_m - 4)],
    [n.lane_m + 0.9, 0, n.distance_m + 2], [n.lane_m - 0.9, 0, n.distance_m + 2],
  ];
  const brakeZ = n && Math.max(2.6, n.distance_m - 5);
  const blue = n && [
    [away * 0.6, 0, 2.8], [away * 1.45, 0.3, 4.5], [away * 1.6, 2.2, 6.5], [away * 1.2, 3.1, 9],
    [away * 0.7, 3.2, Math.max(10, n.distance_m + 3)], [away * 0.4, 3.0, Math.max(12, n.distance_m + 6)],
  ];
  return (
    <svg className="ghost-vectors" width="100%" height="100%" style={{ transform: `rotate(${-imu.roll_deg}deg)` }} data-testid="ghost-vectors">
      <path d={path(yellow, imu, W, H)} className="vec vec-yellow" data-testid="vector-yellow" />
      {red && (
        <>
          <path d={`${path(red, imu, W, H)} Z`} className="vec vec-red-zone" data-testid="vector-red" />
          <path d={path([[-1.5, 0, brakeZ], [1.5, 0, brakeZ]], imu, W, H)} className="vec vec-red-brake" />
        </>
      )}
      {blue && !hud.calm_assist && <path d={path(blue, imu, W, H)} className="vec vec-blue" data-testid="vector-blue" />}
    </svg>
  );
};

export const GhostTags = ({ frame }) => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const tags = focusEntities(frame).map((e) => {
    const T = ENTITY_TYPES[e.type];
    const [x, feet] = toScreen([e.lane_m, T.float, e.distance_m], frame.imu, W, H);
    const h = Math.min((H * 0.94 * T.height) / e.distance_m, H * 0.7);
    return { e, T, x, y: feet - Math.max(h, 6) - 30 };
  });
  // keep the max-3 tags readable when entities bunch up near the vanishing point
  const placed = [];
  tags.sort((a, b) => b.y - a.y).forEach((t) => {
    while (placed.some((p) => Math.abs(p.x - t.x) < 60 && Math.abs(p.y - t.y) < 24)) t.y -= 24;
    placed.push(t);
  });
  return tags.map(({ e, T, x, y }) => {
    const rank = frame.hud.focus_ids.indexOf(e.id) + 1;
    return (
      <div key={e.id} className={`ghost-tag st-${e.stage.toLowerCase()}`} style={{ left: x, top: y, "--ent": T.color }} data-testid={`ghost-tag-${e.id}`}>
        <span className="gt-rank">{rank}</span>
        <span className="gt-dist">{Math.round(e.distance_m)}</span>
      </div>
    );
  });
};

export const Periphery = ({ frame }) => {
  const W = window.innerWidth;
  let left = 0;
  let right = 0;
  let near = 0;
  focusEntities(frame).forEach((e) => {
    const [x] = toScreen([e.lane_m, 0, e.distance_m], frame.imu, W, window.innerHeight);
    const p = clamp(1 - e.distance_m / 60);
    if (x < W * 0.42) left = Math.max(left, p);
    if (x > W * 0.58) right = Math.max(right, p);
    if (e.distance_m <= 20) near = Math.max(near, clamp(1 - e.distance_m / 20) + 0.3);
  });
  const speed = (p) => `${(1.8 - p * 1.4).toFixed(2)}s`;
  return (
    <div className="periphery" data-testid="periphery-cues">
      <i className="pe pe-left" style={{ opacity: left, animationDuration: speed(left) }} data-testid="periphery-left" />
      <i className="pe pe-right" style={{ opacity: right, animationDuration: speed(right) }} data-testid="periphery-right" />
      <i className="pe pe-bottom" style={{ opacity: Math.min(1, near), animationDuration: speed(Math.min(1, near)) }} data-testid="periphery-bottom" />
    </div>
  );
};

export const BreathPacer = () => (
  <div className="breath-pacer" data-testid="breath-pacer">
    <span className="bp-ring" />
    <span className="bp-text">BREATHE</span>
  </div>
);

export const VitalsChip = ({ frame }) => {
  const { heart_rate_bpm } = frame.bio;
  const { stasis_index, state } = frame.eeg;
  const hot = heart_rate_bpm >= 110;
  const C = 2 * Math.PI * 22;
  return (
    <div className={`vitals-chip ${hot ? "is-hot" : ""}`} data-testid="vitals-chip">
      <svg viewBox="0 0 52 52" className={`vc-ring state-${state.toLowerCase()}`}>
        <circle cx="26" cy="26" r="22" className="vc-track" />
        <circle cx="26" cy="26" r="22" className="vc-fill" strokeDasharray={`${C * stasis_index} ${C}`} />
      </svg>
      <div className="vc-hr">
        <Heart size={13} className="vc-heart" style={{ animationDuration: `${60 / heart_rate_bpm}s` }} />
        <b data-testid="heart-rate-value">{heart_rate_bpm}</b>
      </div>
    </div>
  );
};

const TONES = { golem: 196, wraith: 294, pygmy: 523, gnome: 392 };

export function useSpatialCue(frame, enabled) {
  const ctxRef = useRef(null);
  const heard = useRef({});
  useEffect(() => {
    if (!enabled) return;
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = ctxRef.current;
    frame.scan.entities
      .filter((e) => frame.hud.focus_ids.includes(e.id))
      .forEach((e) => {
        const key = `${e.id}|${e.stage}`;
        if (heard.current[e.id] === key) return;
        heard.current[e.id] = key;
        const pan = clamp(((e.bearing_deg - frame.imu.yaw_deg) / 30), -1, 1);
        const beeps = e.stage === "PROXIMITY" ? 2 : 1;
        for (let b = 0; b < beeps; b++) {
          const t0 = ctx.currentTime + b * 0.16;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const panner = ctx.createStereoPanner();
          osc.frequency.value = TONES[e.type] || 440;
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
          panner.pan.value = pan;
          osc.connect(gain).connect(panner).connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 0.15);
        }
      });
  }, [frame, enabled]);
}
