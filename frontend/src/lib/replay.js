import { SESSION_SCHEMA } from "@/lib/recorder";

const lastAtOrBefore = (arr, t) => {
  let lo = 0;
  let hi = arr.length - 1;
  if (hi < 0 || arr[0].ts > t) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arr[mid].ts <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

export function parseSession(text) {
  const out = { meta: null, samples: {}, worlds: [], controls: [], events: [], duration: 0 };
  text.split("\n").forEach((line) => {
    if (!line.trim()) return;
    const o = JSON.parse(line);
    if (o.k === "meta") out.meta = o;
    else if (o.k === "s") (out.samples[o.channel] ||= []).push(o);
    else if (o.k === "w") out.worlds.push(o);
    else if (o.k === "c") out.controls.push(o);
    else if (o.k === "e") out.events.push(o);
    if (o.ts > out.duration) out.duration = o.ts;
  });
  if (!out.meta || out.meta.schema !== SESSION_SCHEMA) throw new Error("Not a G-14 session file");
  if (!out.worlds.length) throw new Error("Session has no recorded frames");
  out.text = text;
  return out;
}

const lerp = (a, b, f) => a + (b - a) * f;
const NUM = ["distance_m", "bearing_deg", "elevation_deg", "lane_m"];

function blendWorld(a, b, f) {
  if (!b || f <= 0) return a;
  const byId = Object.fromEntries((b.entities || []).map((e) => [e.id, e]));
  const entities = (a.entities || []).map((e) => {
    const n = byId[e.id];
    if (!n) return e;
    const m = { ...e };
    NUM.forEach((k) => { if (typeof e[k] === "number") m[k] = lerp(e[k], n[k], f); });
    return m;
  });
  return { ...a, entities, ...(typeof a.lead_m === "number" ? { lead_m: lerp(a.lead_m, b.lead_m, f) } : {}) };
}

export class Player {
  constructor(session) {
    this.s = session;
    this.t = 0;
    this.playing = false;
    this.speed = 1;
  }

  get duration() {
    return this.s.duration;
  }

  advance(dtMs) {
    if (!this.playing) return;
    this.t = Math.min(this.duration, this.t + dtMs * this.speed);
    if (this.t >= this.duration) this.playing = false;
  }

  seek(t) {
    this.t = Math.max(0, Math.min(this.duration, t));
  }

  publish(now, bus) {
    Object.entries(this.s.samples).forEach(([channel, arr]) => {
      const x = arr[lastAtOrBefore(arr, this.t)];
      bus.publish({ channel, value: x.value, unit: x.unit, ts: now, source: "replay", quality: x.quality });
    });
  }

  frameAt() {
    const w = this.s.worlds;
    const i = lastAtOrBefore(w, this.t);
    const a = w[i];
    const b = w[i + 1];
    const f = b ? (this.t - a.ts) / Math.max(1, b.ts - a.ts) : 0;
    return { world: blendWorld(a.world, b?.world, Math.min(1, Math.max(0, f))), state: a.state, game: a.game };
  }

  controlsAt() {
    const c = this.s.controls;
    return c.length ? c[lastAtOrBefore(c, this.t)].controls : null;
  }
}
