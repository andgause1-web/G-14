import { clamp, eegFrom, headMotion } from "@/lib/sim";

const r = (v, p = 2) => Math.round(v * 10 ** p) / 10 ** p;
const IMG = "https://static.prod-images.emergentagent.com/jobs/e985c244-e4a3-4446-beff-f722650fda53/images/";

export const CORRIDOR_IMG = `${IMG}fc311d4f8fcb2e9f797e3292d6be25a89f8558416775516cc4a5142b13a5b5e7.jpeg`;
export const CORRIDOR_LENGTH = 100;
export const BOSS_DISTANCE = 97;

// Overlay art = the pre-rendered "stable" form the observer filter projects over each raw signature
export const ENTITY_TYPES = {
  pygmy: {
    name: "MOON PYGMY", alias: "THE ROARERS", jp: "月の小人", zone: "ZONE 1 · WARDS",
    steiner: "Moon Beings · Angels of the Backward Path", anchor: "The Blood",
    cls: "LUCIFERIC", color: "#c8d4e6", height: 1.15, float: 0, base: 0.45,
    tactic: "SWARM — hold composure, they feed on loss of control",
    img: `${IMG}1c432d3ca50a4600741fb5a614468b7db05c8a6f42f3b0ef3d18947b015239f5.jpeg`,
  },
  wraith: {
    name: "VENUS WRAITH", alias: "THE SLIMES", jp: "金星の亡霊", zone: "ZONE 2 · MESS HALL",
    steiner: "Venus Beings · Archai (Distorted)", anchor: "The Chyle",
    cls: "LUCIFERIC", color: "#d39a4a", height: 2.4, float: 0.5, base: 0.6,
    tactic: "TANK — engage Peltier thermal loop, they track heat",
    counterOn: "HEAT SIGNATURE MASKED",
    img: `${IMG}92de8899652d375c7412a96c1c3ebe8dae2c074c19d42717682a0b9256cc63be.jpeg`,
  },
  golem: {
    name: "PAPERCLIP GOLEM", alias: "THE SENTRIES", jp: "クリップの巨人", zone: "ZONE 3 · ADMINISTRATION",
    steiner: "Ahrimanic Spirits · Egregores", anchor: "The Bones",
    cls: "AHRIMANIC", color: "#a25cff", height: 2.6, float: 0, base: 0.85,
    tactic: "ELITE — wolf-tone 528 Hz breaks their logic",
    counterOn: "PATTERN DISRUPTED",
    img: `${IMG}a1ccead70cebaef4e4e2e092bb93539915b476305c515bbdb906f1c8b1f0c940.jpeg`,
  },
  gnome: {
    name: "MACHINE GNOME", alias: "THE CRAFTERS", jp: "機械の小人", zone: "ZONE 4 · BOILER ROOM",
    steiner: "Saturn Beings · Spirits of Will", anchor: "The Sensory Currents",
    cls: "UNKNOWN", color: "#e0553c", height: 0.95, float: 0, base: 0.15,
    tactic: "SPECIALIST — do not fight, command them",
    img: `${IMG}b68e1d544936c393c2a756cb14e67f9f6a599bb8bfc8813b62f32fdebc71246c.jpeg`,
  },
  boss: {
    name: "THE COMPOSITE", alias: "GENIUS LOCI", jp: "地霊", zone: "DIRECTOR'S OFFICE",
    steiner: "Moon · Venus · Saturn fusion", anchor: "The Building",
    cls: "UNKNOWN", color: "#e5c158", height: 16, float: 0, base: 0.5,
    tactic: "Cannot be killed — observe, then transmute",
    img: `${IMG}4ea80e765f038c651ee3646346254a53b31250e1fc3b19e137de662f4bbfee07.jpeg`,
  },
};

const BOSS = { id: "B-00", type: "boss", lane: 0, fixed: BOSS_DISTANCE };
const ROOM_IMG = (h) => `${IMG}${h}.jpeg`;

export const ZONES = {
  wards: {
    name: "ZONE 1 · THE WARDS", short: "WARDS", jp: "病棟", accent: "#c8d4e6", tint: "rgba(150,175,205,0.10)",
    img: CORRIDOR_IMG,
    roster: [
      { id: "P-01", type: "pygmy", lane: -0.9, offset: 0 }, { id: "P-02", type: "pygmy", lane: -0.25, offset: 2 },
      { id: "P-03", type: "pygmy", lane: 0.45, offset: 1 }, { id: "P-04", type: "pygmy", lane: 1.0, offset: 3.5 },
      { id: "N-01", type: "gnome", lane: 1.35, offset: 4 }, { id: "W-01", type: "wraith", lane: 0.35, offset: 7 },
      { id: "N-02", type: "gnome", lane: -1.4, offset: 9 }, { id: "G-01", type: "golem", lane: -0.55, offset: 12 },
    ],
  },
  mess: {
    name: "ZONE 2 · MESS HALL", short: "MESS HALL", jp: "食堂", accent: "#d39a4a", tint: "rgba(120,170,60,0.14)",
    img: ROOM_IMG("dc1c5f68bf74a04cb62aec3391f8abcc2f90e65a806c463b32e8abc03e0805fd"),
    roster: [
      { id: "W-01", type: "wraith", lane: -0.7, offset: 0 }, { id: "W-02", type: "wraith", lane: 0.8, offset: 5 },
      { id: "P-01", type: "pygmy", lane: 0.2, offset: 2 }, { id: "P-02", type: "pygmy", lane: -0.3, offset: 3 },
      { id: "W-03", type: "wraith", lane: 0.1, offset: 11 }, { id: "N-01", type: "gnome", lane: 1.4, offset: 8 },
    ],
  },
  admin: {
    name: "ZONE 3 · ADMINISTRATION", short: "ADMIN", jp: "管理棟", accent: "#a25cff", tint: "rgba(110,60,200,0.14)",
    img: ROOM_IMG("afc9ecfeb786f07b373699aa6eddaa7d948d294a3aa816bf7422fcd4a19f8f58"),
    roster: [
      { id: "G-01", type: "golem", lane: -0.6, offset: 0 }, { id: "G-02", type: "golem", lane: 0.7, offset: 4 },
      { id: "W-01", type: "wraith", lane: 0.1, offset: 8 }, { id: "G-03", type: "golem", lane: -0.1, offset: 12 },
      { id: "N-01", type: "gnome", lane: -1.4, offset: 6 },
    ],
  },
  boiler: {
    name: "ZONE 4 · BOILER ROOM", short: "BOILER", jp: "ボイラー室", accent: "#e0553c", tint: "rgba(200,70,30,0.14)",
    img: ROOM_IMG("df38a163f5463003aa1381eb7017ce352b4913be9afebf1a075ae25fb5f8f73b"),
    roster: [
      { id: "N-01", type: "gnome", lane: -1.2, offset: 0 }, { id: "N-02", type: "gnome", lane: 1.2, offset: 2 },
      { id: "N-03", type: "gnome", lane: -0.4, offset: 6 }, { id: "N-04", type: "gnome", lane: 0.6, offset: 9 },
      { id: "G-01", type: "golem", lane: 0.1, offset: 13 }, { id: "P-01", type: "pygmy", lane: -0.8, offset: 4 },
    ],
  },
};

export const FOCUS_LIMIT = 3;
export const CALM_HR = 110;

export const STAGES = ["DETECTED", "CLASSIFYING", "IDENTIFIED", "TRACKING", "PROXIMITY"];
export const stageOf = (d) => (d > 80 ? "DETECTED" : d > 60 ? "CLASSIFYING" : d > 40 ? "IDENTIFIED" : d > 20 ? "TRACKING" : "PROXIMITY");

const GNOME_THREAT = { NEUTRAL: 0.15, SUBMITTED: 0.03, HOSTILE: 0.75 };

export const DEFAULT_CORRIDOR = {
  distance: 100, interval: 20, composure: 70, filter: true, tone: false, thermal: false, gnomeMood: "NEUTRAL",
  yaw: 0, pitch: 0, roll: 0, autoSway: true, resetKey: 0, zone: "wards", mode: "throttle", audio: true, gaze: 0, mouseGaze: false, loadManual: false, load: 30,
  run: "off", speed: 30, bodyHeight: 178, stance: "stand", keyRun: null,
  show: { pygmy: true, wraith: true, golem: true, gnome: true, boss: true },
};

export const stepCloser = (c) => ({ ...c, distance: Math.max(0, Math.ceil(c.distance / c.interval) * c.interval - c.interval) });
export const stepBack = (c) => ({ ...c, distance: Math.min(100, Math.floor(c.distance / c.interval) * c.interval + c.interval) });

function buildEntity(e, c, lead, t) {
  const T = ENTITY_TYPES[e.type];
  const jitter = e.type === "pygmy" ? Math.sin(t * 2.3 + e.offset * 3) * 0.35 : e.type === "wraith" ? Math.sin(t * 0.4) * 0.15 : 0;
  const d0 = e.fixed ?? clamp(lead + e.offset, 3, 95);
  const d = e.fixed ?? clamp(d0 + (e.type === "pygmy" ? Math.sin(t * 1.7 + e.offset) * 0.8 : 0), 3, 95);
  const lane = e.lane + jitter;
  const prox = 1 - d / CORRIDOR_LENGTH;
  let threat = T.base * (0.4 + 0.6 * prox);
  let disposition = "HOSTILE";
  let countered = false;
  if (e.type === "pygmy") threat *= 1.4 - c.composure / 100;
  if (e.type === "gnome") {
    disposition = c.gnomeMood;
    threat = GNOME_THREAT[c.gnomeMood] * (0.5 + 0.5 * prox);
  }
  if (e.type === "boss") {
    disposition = "DORMANT";
    threat = T.base;
  }
  if ((e.type === "golem" && c.tone) || (e.type === "wraith" && c.thermal)) {
    threat *= e.type === "golem" ? 0.4 : 0.35;
    countered = true;
  }
  return {
    id: e.id,
    class: T.cls,
    type: e.type,
    name: T.name,
    stage: e.type === "boss" ? "OBSERVED" : stageOf(d0),
    disposition,
    countered,
    bearing_deg: r((Math.atan2(lane, d) * 180) / Math.PI, 2),
    elevation_deg: 0,
    distance_m: r(d, 1),
    lane_m: r(lane, 2),
    threat: r(clamp(threat)),
  };
}

export function envReadings(entities, t) {
  const p2 = (e) => (1 - e.distance_m / CORRIDOR_LENGTH) ** 2;
  const sum = (types, k) => entities.filter((e) => types.includes(e.type)).reduce((s, e) => s + p2(e) * k, 0);
  return {
    sensor: "TSL1401CL+MLX90640+BMI270",
    em_ut: r(45 + sum(["golem"], 40) + sum(["pygmy", "wraith", "gnome"], 6) + Math.sin(t * 3) * 0.8, 1),
    thermal_c: r(21 - sum(["wraith"], 8) + Math.sin(t * 0.7) * 0.2, 2),
    imu_jitter_deg: r(0.3 + sum(["pygmy"], 0.8) + Math.sin(t * 5) * 0.04, 3),
  };
}

export const RUN = { walk: 1.4, sprint: 6.5, accel: 4, decel: 6, brakeA: 5, reaction: 0.3 };
export const brakeDistance = (v) => v * RUN.reaction + (v * v) / (2 * RUN.brakeA);
const EYE = { stand: 0.936, crouch: 0.58 };
const eyeOf = (stance, bodyCm) => (stance === "prone" ? 0.35 : (bodyCm / 100) * EYE[stance]);

// scripted run: walk in, sprint the open stretch, slow and crouch near contacts
function autoRun(lead, nearest) {
  if (lead <= 0.5) return { target: 0, stance: "stand" };
  if (nearest < 14) return { target: 0.9, stance: "crouch" };
  if (lead > 75) return { target: 1.6, stance: "stand" };
  if (lead > 45) return { target: 6.2, stance: "stand" };
  if (lead > 22) return { target: 3.0, stance: "stand" };
  return { target: 1.2, stance: lead < 10 ? "stand" : "crouch" };
}

export const obsTierOf = (load) => (load >= 0.9 ? 3 : load >= 0.7 ? 2 : load >= 0.4 ? 1 : 0);

export function makeCorridorSim() {
  let lead = DEFAULT_CORRIDOR.distance;
  let last = null;
  let observe = 0;
  let resetKey = 0;
  let speed = 0;
  let eye = null;
  let phase = 0;
  let travelled = 0;
  let prevNearest = CORRIDOR_LENGTH;
  const prevD = {};
  return (c, t, seq) => {
    const dt = last == null ? 0 : Math.min(0.1, Math.max(0, t - last));
    last = t;
    if (c.resetKey !== resetKey) {
      resetKey = c.resetKey;
      lead = c.distance;
      observe = 0;
      speed = 0;
      travelled = 0;
    }
    const running = c.run && c.run !== "off";
    const auto = c.run === "auto" ? autoRun(lead, prevNearest) : null;
    const stance = auto ? auto.stance : c.stance;
    let target = !running ? 0 : auto ? auto.target : c.keyRun ?? c.speed / 10;
    if (stance === "crouch") target = Math.min(target, 2);
    if (stance === "prone") target = Math.min(target, 0.6);
    if (lead <= 0) target = 0;
    speed = clamp(speed + clamp(target - speed, -RUN.decel * dt, RUN.accel * dt), 0, 9);
    if (running) {
      const step = Math.min(lead, speed * dt);
      lead -= step;
      travelled += step;
      if (lead <= 0) speed = 0;
    } else {
      speed = 0;
      lead += (c.distance - lead) * Math.min(1, dt * 1.6);
      if (Math.abs(c.distance - lead) < 0.3) lead = c.distance;
    }
    const eyeT = eyeOf(stance, c.bodyHeight ?? 178);
    eye = eye == null ? eyeT : eye + (eyeT - eye) * Math.min(1, dt * 5);
    phase += dt * Math.PI * (1.6 + speed * 0.22);
    const imu = {
      ...headMotion(c, t, { phase, amp: speed > 0.15 ? 0.12 + speed * 0.12 : 0, breathHz: 0.23 + speed * 0.06 }),
      head_height_m: r(eye, 2),
    };
    const zone = ZONES[c.zone];
    const entities = [...zone.roster, BOSS].filter((e) => c.show[e.type]).map((e) => buildEntity(e, c, lead, t));
    // contact priority: threat weight x (1 / distance) x approach-speed bonus
    entities.forEach((e) => {
      const p = prevD[e.id];
      const v = dt > 0 && p != null ? (p - e.distance_m) / dt : 0;
      prevD[e.id] = e.distance_m;
      e.approach_mps = r(Math.max(0, v), 1);
      const w = e.disposition === "HOSTILE" ? e.threat : e.threat * 0.3;
      e.score = r((w * 100 * (1 + clamp(v / 4))) / Math.max(1, e.distance_m), 3);
    });
    const hostile = entities.filter((e) => e.disposition === "HOSTILE");
    const nearest = hostile.reduce((m, e) => Math.min(m, e.distance_m), CORRIDOR_LENGTH);
    const maxThreat = hostile.reduce((m, e) => Math.max(m, e.threat), 0);
    const close = hostile.filter((e) => e.distance_m <= 40).length;
    const comp = c.composure / 100;
    const proxN = 1 - nearest / CORRIDOR_LENGTH;
    prevNearest = nearest;
    const brake = brakeDistance(speed);
    const overrun = running && speed > 0.3 && hostile.some((e) => e.distance_m <= brake + 2);

    const stress = clamp(proxN * 0.85 * (1.3 - comp) + (c.filter ? 0 : 0.35) + speed * 0.03);
    const eeg = eegFrom({ alpha: 60 - 45 * stress, beta: 20 + 65 * stress, theta: 28 - 18 * stress, delta: 12 - 7 * stress, gamma: 8 + 60 * stress }, t);
    const autoLoad = clamp(0.12 + 0.45 * maxThreat + 0.05 * close + (c.filter ? 0 : 0.3) + (1 - comp) * 0.15 + speed * 0.055 + (overrun ? 0.1 : 0) - (stance === "crouch" ? 0.04 : stance === "prone" ? 0.07 : 0));
    const load = c.loadManual ? c.load / 100 : autoLoad;
    const stability = clamp((c.filter ? 0.92 : 0.35) - 0.55 * proxN * (1.2 - comp));

    if (c.show.boss && c.filter && Math.abs(imu.yaw_deg) < 12) observe = Math.min(100, observe + dt * 1.5);

    const hr = 64 + stress * 75 + speed * 6 + Math.sin(t * 1.9) * 1.5;
    const ghost = c.mode === "ghost";
    const calm = ghost && hr >= CALM_HR;
    // Dead Core limit: only the top-N hostiles by threat x proximity get full attention
    const focus = hostile
      .filter((e) => e.stage !== "DETECTED")
      .sort((a, b) => b.threat * (1.2 - b.distance_m / 100) - a.threat * (1.2 - a.distance_m / 100))
      .slice(0, calm ? 2 : FOCUS_LIMIT)
      .map((e) => e.id);
    const focusD = hostile.filter((e) => focus.includes(e.id)).map((e) => e.distance_m);
    const nearestFocus = focusD.length ? Math.min(...focusD) : null;
    // calm by default: quiet -> peripheral -> audio -> full overlay
    const alert = !ghost ? 3 : nearestFocus == null ? 0 : nearestFocus > 40 ? 1 : nearestFocus > 20 ? 2 : 3;

    return {
      schema: "g14.hud.v1",
      seq,
      t_ms: Date.now(),
      source: "SIMULATOR",
      scene: "asylum_corridor",
      zone: c.zone,
      lead_m: r(lead, 1),
      eeg,
      imu,
      bio: { sensor: "MAX30102", heart_rate_bpm: Math.round(hr), spo2: Math.round(98 - stress * 3) },
      env: envReadings(entities, t),
      run: { mode: c.run || "off", speed_mps: r(speed, 2), eye_m: r(eye, 2), stance, brake_m: r(brake, 1), travelled_m: r(travelled, 1), overrun },
      scan: { sensor: "TSL1401CL", resonance: r(clamp(0.25 + 0.65 * proxN)), stability: r(stability), entities },
      hud: {
        cognitive_load: r(load),
        throttle_tier: load >= 0.8 ? 2 : load >= 0.6 ? 1 : 0,
        target_lock: c.filter && hostile.some((e) => e.distance_m <= 40),
        stable_zone: stability >= 0.8,
        observer_filter: c.filter,
        boss_observation: r(observe / 100, 3),
        mode: c.mode,
        calm_assist: calm,
        focus_ids: focus,
        alert_level: alert,
        obs_tier: obsTierOf(load),
      },
    };
  };
}

export const CORRIDOR_LEGEND = Object.values(ENTITY_TYPES).map((T) => [T.color, T.name.split(" ").slice(-1)[0]]);
