// Telemetry bus: every sensor/HUD value is published here and read back resolved.
export const CHANNELS = [
  { id: "hr_bpm", label: "HEART RATE", unit: "BPM", min: 40, max: 200, sensor: "MAX30102" },
  { id: "spo2", label: "SpO₂", unit: "%", min: 85, max: 100, sensor: "MAX30102" },
  { id: "eeg_alpha", label: "EEG α ALPHA", unit: "rel", min: 0, max: 1, sensor: "ADS1299" },
  { id: "eeg_beta", label: "EEG β BETA", unit: "rel", min: 0, max: 1, sensor: "ADS1299" },
  { id: "eeg_theta", label: "EEG θ THETA", unit: "rel", min: 0, max: 1, sensor: "ADS1299" },
  { id: "eeg_delta", label: "EEG δ DELTA", unit: "rel", min: 0, max: 1, sensor: "ADS1299" },
  { id: "eeg_gamma", label: "EEG γ GAMMA", unit: "rel", min: 0, max: 1, sensor: "ADS1299" },
  { id: "imu_yaw", label: "IMU YAW", unit: "°", min: -180, max: 180, sensor: "BMI270" },
  { id: "imu_pitch", label: "IMU PITCH", unit: "°", min: -60, max: 60, sensor: "BMI270" },
  { id: "imu_roll", label: "IMU ROLL", unit: "°", min: -45, max: 45, sensor: "BMI270" },
  { id: "imu_jitter", label: "IMU JITTER", unit: "°", min: 0, max: 2, sensor: "BMI270" },
  { id: "cog_load", label: "COG LOAD", unit: "%", min: 0, max: 100, sensor: "derived" },
  { id: "stasis", label: "STASIS", unit: "%", min: 0, max: 100, sensor: "ADS1299" },
  { id: "temp", label: "THERMAL", unit: "°C", min: 10, max: 30, sensor: "MLX90640" },
  { id: "em_field", label: "EM FIELD", unit: "µT", min: 30, max: 120, sensor: "EM coil" },
  { id: "link_status", label: "LINK", unit: "q", min: 0, max: 1, sensor: "ESP32" },
];
export const CH = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));
export const SENSOR_IDS = CHANNELS.filter((c) => c.id !== "cog_load").map((c) => c.id);
export const SOURCES = ["sim", "replay", "serial"];
const HIST_N = 90;
const HIST_MS = 100;

class TelemetryBus {
  constructor() {
    this.route = {};
    this.override = {};
    this.latest = {};
    this.hist = {};
    this.histAt = {};
    this.out = {};
    CHANNELS.forEach((c) => {
      this.route[c.id] = "sim";
      this.override[c.id] = null;
      this.latest[c.id] = {};
      this.hist[c.id] = [];
      this.histAt[c.id] = 0;
    });
  }

  publish(s) {
    this.latest[s.channel][s.source] = s;
  }

  publishSim(values, now) {
    Object.entries(values).forEach(([channel, value]) =>
      this.publish({ channel, value, unit: CH[channel].unit, ts: now, source: "sim", quality: 1 }));
  }

  setRoute(ch, src) {
    this.route[ch] = src;
  }

  routeAll(src) {
    const prev = { ...this.route };
    CHANNELS.forEach((c) => { this.route[c.id] = src; });
    return prev;
  }

  restoreRoutes(prev) {
    Object.assign(this.route, prev);
  }

  setOverride(ch, v) {
    this.override[ch] = v;
  }

  // fall back to sim when the chosen source is stale (> timeout_ms) or low quality
  resolve(ch, now, cfg) {
    const want = this.route[ch];
    const s = this.latest[ch][want];
    const ok = want === "sim" || (s && now - s.ts <= cfg.timeout_ms && s.quality >= cfg.min_quality);
    let out = ok ? s : this.latest[ch].sim;
    if (out.source === "sim" && this.override[ch] != null) out = { ...out, value: this.override[ch], manual: true };
    const res = { ...out, route: want, fallback: !ok };
    this.out[ch] = res;
    if (now - this.histAt[ch] >= HIST_MS) {
      this.histAt[ch] = now;
      const h = this.hist[ch];
      h.push(res.value);
      if (h.length > HIST_N) h.shift();
    }
    return res;
  }

  resolveAll(ids, now, cfg) {
    return Object.fromEntries(ids.map((id) => [id, this.resolve(id, now, cfg)]));
  }

  meta() {
    return Object.fromEntries(Object.entries(this.out).map(([k, s]) => [k, { source: s.source, route: s.route, fallback: s.fallback, quality: s.quality, manual: !!s.manual, value: s.value }]));
  }
}

export const bus = new TelemetryBus();

// Serial source stub: real ESP32 / Teensy bridge plugs in here and calls bus.publish({... source: "serial" })
export const serialSource = {
  connected: false,
  connect: async () => ({ ok: false, reason: "Serial bridge is a stub — no device connected" }),
};
