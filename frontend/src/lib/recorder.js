import { CHANNELS } from "@/lib/telemetry";

const r4 = (v) => (typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v);
export const SESSION_SCHEMA = "g14.session.v1";
export const TICK_MS = 100;
export const MAX_MS = 10 * 60 * 1000;

// JSON-lines session: meta, k:"s" channel samples, k:"w" world+sim state, k:"c" controls, k:"e" game events
export class Recorder {
  active = false;

  start({ name, notes, scene, rulesVersion }, now) {
    this.lines = [JSON.stringify({ k: "meta", schema: SESSION_SCHEMA, name, notes, scene, started_at: new Date().toISOString(), rules_version: rulesVersion })];
    this.t0 = now;
    this.last = -Infinity;
    this.lastControls = null;
    this.meta = { name, notes, scene };
    this.active = true;
  }

  ts(now) {
    return Math.max(0, Math.round(now - this.t0));
  }

  tick(now, tel, world, state, controls, game) {
    if (!this.active || now - this.last < TICK_MS) return;
    this.last = now;
    const ts = this.ts(now);
    CHANNELS.forEach(({ id }) => {
      const s = tel[id];
      if (s) this.lines.push(JSON.stringify({ k: "s", channel: id, value: r4(s.value), unit: s.unit, ts, source: s.source, quality: r4(s.quality) }));
    });
    if (controls !== this.lastControls) {
      this.lastControls = controls;
      this.lines.push(JSON.stringify({ k: "c", ts, controls }));
    }
    this.lines.push(JSON.stringify({ k: "w", ts, world, state, game }));
  }

  event(now, type, data) {
    if (this.active) this.lines.push(JSON.stringify({ k: "e", ts: this.ts(now), type, data }));
  }

  elapsed(now) {
    return this.active ? now - this.t0 : 0;
  }

  stop(now) {
    this.active = false;
    return { ...this.meta, duration_ms: this.ts(now), text: this.lines.join("\n"), line_count: this.lines.length };
  }
}
