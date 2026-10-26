export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const r = (v, p = 2) => Math.round(v * 10 ** p) / 10 ** p;

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;
export const WS_HUD_URL = `${BACKEND_URL.replace(/^http/, "ws")}/api/ws/hud`;

export const PRESETS = {
  calm: { alpha: 62, beta: 22, theta: 30, delta: 12, gamma: 8, entityCount: 2, distance: 140, threat: 15, resonance: 35, stability: 88 },
  combat: { alpha: 28, beta: 70, theta: 14, delta: 6, gamma: 30, entityCount: 4, distance: 45, threat: 78, resonance: 68, stability: 55 },
  overload: { alpha: 12, beta: 92, theta: 8, delta: 4, gamma: 85, entityCount: 5, distance: 18, threat: 96, resonance: 95, stability: 18 },
};

export const DEFAULT_CONTROLS = { ...PRESETS.calm, yaw: 0, pitch: 0, roll: 0, autoSway: true };

export const DEFAULT_VIEW = {
  layers: { entities: true, radar: true, reticle: true, stasis: true, compass: true },
  throttling: true,
  scanlines: true,
  crosshair: "cross",
  crosshairOpacity: 90,
};

export const OPERATOR = {
  callsign: "AETHER-01",
  unit: "G-14 OPERATOR",
  rank: "VANGUARD",
  portrait: "https://static.prod-images.emergentagent.com/jobs/e985c244-e4a3-4446-beff-f722650fda53/images/61eedf53fbadcc2550d76d329dd011795b218b492a9f6a1d751c4fa8a370dc7c.jpeg",
};

// Placeholder loadout; replace with real weapon/equipment data later
export const LOADOUT = [
  { key: "1", slot: "PRIMARY", name: "UNASSIGNED", icon: "crosshair", active: true },
  { key: "2", slot: "SECONDARY", name: "UNASSIGNED", icon: "target" },
  { key: "3", slot: "EQUIP A", name: "EMPTY", icon: "shield" },
  { key: "4", slot: "EQUIP B", name: "EMPTY", icon: "box" },
];

export const FOV_H = 90;
export const FOV_V = 56;

const SLOTS = [
  { b: -26, e: -3, d: 1.0 },
  { b: 24, e: 2, d: 1.35 },
  { b: -6, e: -5, d: 0.75 },
  { b: 40, e: 0, d: 1.6 },
  { b: 10, e: 1, d: 0.55 },
];

function entityClass(i, threat) {
  if (i === 1 || i === 3) return "LUCIFERIC";
  if (i === 0) return threat > 0.35 ? "AHRIMANIC" : "UNKNOWN";
  if (i === 2) return threat > 0.6 ? "AHRIMANIC" : "UNKNOWN";
  return "AHRIMANIC";
}

const CLASS_BIAS = { AHRIMANIC: 0.08, LUCIFERIC: -0.2, UNKNOWN: -0.1 };

function buildEntities(c, t) {
  const threat = c.threat / 100;
  return SLOTS.slice(0, c.entityCount).map((s, i) => {
    const cls = entityClass(i, threat);
    return {
      id: `E-${String(i + 1).padStart(2, "0")}`,
      class: cls,
      bearing_deg: r(s.b + Math.sin(t * 0.22 + i * 2.1) * 5, 1),
      elevation_deg: r(s.e + Math.sin(t * 0.4 + i) * 0.8, 1),
      distance_m: r(Math.max(3, c.distance * s.d + Math.sin(t * 0.3 + i * 1.7) * 3), 1),
      threat: r(clamp(threat * (1 - i * 0.1) + CLASS_BIAS[cls])),
    };
  });
}

export function buildFrame(c, t, seq) {
  const sway = c.autoSway;
  const yaw = wrap180(c.yaw + (sway ? Math.sin(t * 0.31) * 9 + Math.sin(t * 1.3) * 1.2 : 0));
  const pitch = c.pitch + (sway ? Math.sin(t * 0.53) * 1.8 : 0);
  const roll = c.roll + (sway ? Math.sin(t * 0.71) * 1.4 : 0);

  const keys = ["delta", "theta", "alpha", "beta", "gamma"];
  const jit = keys.map((k, i) => Math.max(0.5, c[k] * (1 + 0.08 * Math.sin(t * (1.7 + i * 0.9) + i))));
  const sum = jit.reduce((a, b) => a + b, 0);
  const bands = Object.fromEntries(keys.map((k, i) => [k, r(jit[i] / sum, 3)]));
  const stasis = clamp(0.45 + bands.alpha * 1.2 + bands.theta * 0.5 - bands.beta * 0.7 - bands.gamma * 0.5);
  const state = stasis >= 0.6 ? "STABLE" : stasis >= 0.25 ? "DRIFTING" : "UNSTABLE";

  const threat = c.threat / 100;
  const resonance = c.resonance / 100;
  const stability = c.stability / 100;
  const entities = buildEntities(c, t);
  const load = clamp(0.5 * bands.beta + 0.25 * threat + 0.04 * entities.length + 0.25 * (1 - stability));

  return {
    schema: "g14.hud.v1",
    seq,
    t_ms: Date.now(),
    source: "SIMULATOR",
    eeg: { sensor: "ADS1299", bands, stasis_index: r(stasis), state },
    imu: { sensor: "BMI270", yaw_deg: r(yaw, 1), pitch_deg: r(pitch, 1), roll_deg: r(roll, 1) },
    scan: { sensor: "TSL1401CL", resonance: r(resonance), stability: r(stability), entities },
    hud: {
      cognitive_load: r(load),
      throttle_tier: load >= 0.8 ? 2 : load >= 0.6 ? 1 : 0,
      target_lock: entities.some((e) => e.class === "AHRIMANIC") && resonance >= 0.5,
      stable_zone: stability >= 0.8,
    },
  };
}

const PRIORITY = { compass: 1, radar: 1, stasis: 2, entities: 3, reticle: 3 };

export function layerOpacity(name, tier) {
  const p = PRIORITY[name];
  if (tier >= 2 && p === 1) return 0.12;
  if (tier >= 2 && p === 2) return 0.35;
  if (tier >= 1 && p === 1) return 0.3;
  return 1;
}

export function project(ent, imu) {
  const d = wrap180(ent.bearing_deg - imu.yaw_deg);
  return {
    x: 50 + (d / FOV_H) * 100,
    y: 50 - ((ent.elevation_deg - imu.pitch_deg) / FOV_V) * 100,
    visible: Math.abs(d) < FOV_H / 2 + 10,
  };
}

export const threatLabel = (t) => (t >= 0.7 ? "HIGH" : t >= 0.4 ? "MODERATE" : "LOW");

export const SCHEMA_FIELDS = [
  { field: "schema", type: "string", unit: "—", range: '"g14.hud.v1"', sensor: "—" },
  { field: "seq", type: "int", unit: "count", range: "0 … ∞", sensor: "—" },
  { field: "t_ms", type: "int", unit: "ms epoch", range: "—", sensor: "—" },
  { field: "eeg.bands.{delta,theta,alpha,beta,gamma}", type: "float", unit: "rel. power", range: "0 … 1 (sum ≈ 1)", sensor: "ADS1299" },
  { field: "eeg.stasis_index", type: "float", unit: "index", range: "0 … 1", sensor: "ADS1299" },
  { field: "eeg.state", type: "enum", unit: "—", range: "STABLE | DRIFTING | UNSTABLE", sensor: "ADS1299" },
  { field: "imu.yaw_deg / pitch_deg / roll_deg", type: "float", unit: "deg", range: "-180 … 180", sensor: "BMI270" },
  { field: "scan.resonance", type: "float", unit: "norm.", range: "0 … 1", sensor: "TSL1401CL" },
  { field: "scan.stability", type: "float", unit: "norm.", range: "0 … 1", sensor: "TSL1401CL" },
  { field: "scan.entities[].id", type: "string", unit: "—", range: "E-01 …", sensor: "TSL1401CL" },
  { field: "scan.entities[].class", type: "enum", unit: "—", range: "AHRIMANIC | LUCIFERIC | UNKNOWN", sensor: "TSL1401CL" },
  { field: "scan.entities[].bearing_deg / elevation_deg", type: "float", unit: "deg", range: "-180 … 180", sensor: "TSL1401CL" },
  { field: "scan.entities[].distance_m", type: "float", unit: "m", range: "0 … 300", sensor: "TSL1401CL" },
  { field: "scan.entities[].threat", type: "float", unit: "norm.", range: "0 … 1", sensor: "TSL1401CL" },
  { field: "hud.cognitive_load", type: "float", unit: "norm.", range: "0 … 1", sensor: "derived" },
  { field: "hud.throttle_tier", type: "int", unit: "tier", range: "0 | 1 | 2", sensor: "derived" },
  { field: "hud.target_lock / stable_zone", type: "bool", unit: "—", range: "true | false", sensor: "derived" },
];

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}
