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

const IMG = "https://static.prod-images.emergentagent.com/jobs/e985c244-e4a3-4446-beff-f722650fda53/images/";

export const VISOR_TYPES = {
  seraph: {
    name: "HALO SERAPH", alias: "THE FALSE DAWN", jp: "偽光の天使", cls: "LUCIFERIC", color: "#9fd8ff",
    tactic: "LURE — do not follow the light, keep reticle low",
    img: `${IMG}a7e8de9259608dea2f535fcabdc7901e7e58e8ca11fc23e13815df4e43c5eb01.jpeg`,
  },
  shard: {
    name: "GLASS HERALD", alias: "THE SHATTERED", jp: "硝子の使者", cls: "LUCIFERIC", color: "#f2efe6",
    tactic: "MIRAGE — false depth, trust the rangefinder",
    img: `${IMG}df4e01e1cbfcd2fb6de6c5fddd3eb3a295399a1f39aacac39ae276a2b9221473.jpeg`,
  },
  choir: {
    name: "VEILED CHOIR", alias: "THE BECKONING", jp: "ヴェールの聖歌隊", cls: "LUCIFERIC", color: "#f0d79a",
    tactic: "SIREN — mute harmonic band, breathe slow",
    img: `${IMG}6aa064d7a98191912eafbb9bb247bf8283a5a9bf7cb2bc3a8e0cab8901a0edb2.jpeg`,
  },
  sentinel: {
    name: "IRON EGREGORE", alias: "THE SENTRIES", jp: "鉄の集合霊", cls: "AHRIMANIC", color: "#ff2a4b",
    tactic: "HARD THREAT — lock and hold range",
    img: `${IMG}a1ccead70cebaef4e4e2e092bb93539915b476305c515bbdb906f1c8b1f0c940.jpeg`,
  },
};

const SLOTS = [
  { b: -26, e: -3, d: 1.0, type: "seraph" },
  { b: 24, e: 2, d: 1.35, type: "shard" },
  { b: -6, e: -5, d: 0.75, type: "sentinel" },
  { b: 40, e: 0, d: 1.6, type: "choir" },
  { b: 10, e: 1, d: 0.55, type: "sentinel" },
];

export const visorStage = (d) => (d > 220 ? "DETECTED" : d > 160 ? "CLASSIFYING" : d > 90 ? "IDENTIFIED" : d > 35 ? "TRACKING" : "PROXIMITY");

const CLASS_BIAS = { AHRIMANIC: 0.08, LUCIFERIC: -0.2, UNKNOWN: -0.1 };

function buildEntities(c, t) {
  const threat = c.threat / 100;
  return SLOTS.slice(0, c.entityCount).map((s, i) => {
    const T = VISOR_TYPES[s.type];
    const cls = T.cls === "LUCIFERIC" ? "LUCIFERIC" : threat > 0.35 + (i === 2 ? 0.25 : 0) ? "AHRIMANIC" : "UNKNOWN";
    const ph = t * 0.3 + i * 1.7;
    const d = Math.max(3, c.distance * s.d + Math.sin(ph) * 3);
    const v = Math.max(0, -Math.cos(ph) * 0.9);
    const th = clamp(threat * (1 - i * 0.1) + CLASS_BIAS[cls]);
    return {
      id: `E-${String(i + 1).padStart(2, "0")}`,
      class: cls,
      type: s.type,
      label: cls === "UNKNOWN" ? "UNRESOLVED SIGNATURE" : T.name,
      stage: visorStage(d),
      disposition: cls === "UNKNOWN" ? "NEUTRAL" : "HOSTILE",
      bearing_deg: r(s.b + Math.sin(t * 0.22 + i * 2.1) * 5, 1),
      elevation_deg: r(s.e + Math.sin(t * 0.4 + i) * 0.8, 1),
      distance_m: r(d, 1),
      approach_mps: r(v, 1),
      threat: r(th),
      score: r((th * 100 * (1 + clamp(v / 4))) / Math.max(1, d), 3),
      ...(cls === "LUCIFERIC" ? { false_light: r(clamp(0.78 - th * 0.3 + Math.sin(t * 0.9 + i) * 0.03)) } : {}),
    };
  });
}

export function eegFrom(raw, t) {
  const keys = ["delta", "theta", "alpha", "beta", "gamma"];
  const jit = keys.map((k, i) => Math.max(0.5, raw[k] * (1 + 0.08 * Math.sin(t * (1.7 + i * 0.9) + i))));
  const sum = jit.reduce((a, b) => a + b, 0);
  const bands = Object.fromEntries(keys.map((k, i) => [k, r(jit[i] / sum, 3)]));
  const stasis = clamp(0.45 + bands.alpha * 1.2 + bands.theta * 0.5 - bands.beta * 0.7 - bands.gamma * 0.5);
  const state = stasis >= 0.6 ? "STABLE" : stasis >= 0.25 ? "DRIFTING" : "UNSTABLE";
  return { sensor: "ADS1299", bands, stasis_index: r(stasis), state };
}

// natural head motion: breathing bob + slow postural drift; optional gait = { phase, amp, breathHz }
export function headMotion(c, t, gait = null) {
  const on = c.autoSway;
  const bHz = gait?.breathHz ?? 0.23;
  const br = Math.sin(t * 2 * Math.PI * bHz);
  const amp = on ? gait?.amp ?? 0 : 0;
  const ph = gait?.phase ?? 0;
  const yaw = on ? Math.sin(t * 0.07) * 1.3 + Math.sin(t * 0.19 + 1) * 0.45 + Math.sin(t * 1.1) * 0.06 + Math.sin(ph) * amp * 0.4 : 0;
  const pitch = on ? br * 0.35 + Math.sin(t * 0.11 + 2) * 0.4 + Math.cos(2 * ph) * amp : 0;
  const roll = on ? Math.sin(t * 0.13) * 0.25 + br * 0.08 + Math.sin(ph) * amp * 0.6 : 0;
  return {
    sensor: "BMI270",
    yaw_deg: r(wrap180(c.yaw + yaw), 2),
    pitch_deg: r(c.pitch + pitch, 2),
    roll_deg: r(c.roll + roll, 2),
  };
}

export function buildFrame(c, t, seq) {
  const eeg = eegFrom(c, t);
  const { bands } = eeg;
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
    eeg,
    imu: headMotion(c, t),
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
  { field: "scan.entities[].type (optional)", type: "string", unit: "—", range: "seraph | shard | choir | sentinel | pygmy | wraith | golem | gnome | boss", sensor: "visor / corridor" },
  { field: "scan.entities[].false_light (optional)", type: "float", unit: "norm.", range: "0 … 1 dampener", sensor: "visor" },
  { field: "imu.head_height_m (optional)", type: "float", unit: "m", range: "0.3 … 1.9", sensor: "BMI270+baro" },
  { field: "run.{mode,speed_mps,eye_m,stance,brake_m,travelled_m}", type: "object", unit: "m/s · m", range: "mode off | manual | auto", sensor: "corridor run" },
  { field: "scan.entities[].stage (optional)", type: "enum", unit: "—", range: "DETECTED | CLASSIFYING | IDENTIFIED | TRACKING | PROXIMITY | OBSERVED", sensor: "corridor" },
  { field: "scan.entities[].disposition (optional)", type: "enum", unit: "—", range: "HOSTILE | NEUTRAL | SUBMITTED | DORMANT", sensor: "corridor" },
  { field: "hud.boss_observation (optional)", type: "float", unit: "norm.", range: "0 … 1", sensor: "corridor" },
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
