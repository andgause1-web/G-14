import { clamp, eegFromTel, resistOf, FOV_H } from "@/lib/sim";

const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const rand = ([a, b]) => a + Math.random() * (b - a);
const lerp = (a, b, f) => a + (b - a) * f;

export const stageOf = (stasis, stages) => {
  const s = [...stages].sort((a, b) => b.min_stasis - a.min_stasis).find((x) => stasis >= x.min_stasis);
  return s ? s.stage : stages[stages.length - 1].stage;
};

const fresh = (P) => ({
  pool: P.stasis.start, fullAssistS: 0, fatigued: false, breach: null, takeover: null, cooldown: {},
  invert: 0, nextInvert: rand(P.invert_every_s), falseTags: [], tagSeq: 0, jx: 0, jy: 0, fx: null,
});

// Possession: damage is loss of motor ownership. Stasis pool (0-100) = how much of you is still yours.
export function makePossession() {
  let s = null;
  const api = {
    getState: () => s && { ...s, cooldown: { ...s.cooldown }, falseTags: [...s.falseTags] },
    setState: (x) => { if (x) s = { ...x, cooldown: { ...x.cooldown }, falseTags: [...x.falseTags] }; },
    fx: () => s?.fx ?? null,
    step(dt, tel, world, rules, { bus, now }, scene) {
      const P = rules.possession;
      if (!s) s = fresh(P);
      const bands = eegFromTel({ ...tel, stasis: { value: s.pool } }).bands;
      const range = P.stasis.pressure_range_m[scene];
      const hostile = world.entities.filter((e) => e.disposition === "HOSTILE" && !(s.cooldown[e.id] > 0));
      const near = hostile.filter((e) => e.distance_m <= range);
      let pressure = 0;
      let dom = null;
      let domP = 0;
      near.forEach((e) => {
        const prof = P.profiles[e.type] ?? P.profiles.default;
        let p = P.stasis.entity_drain_per_s * prof.drain * e.threat * clamp(1 - e.distance_m / range);
        // egregore pull scales with the number of other nearby contacts
        if (P.egregore.types.includes(e.type)) p *= 1 + P.egregore.contact_scale * (near.length - 1);
        p *= 1 - (world.turretFx?.ent[e.id]?.damp ?? 0);
        pressure += p;
        if (p > domP) { domP = p; dom = e; }
      });
      const R = P.rigidity;
      const balance = bands.alpha + bands.theta - bands.beta - bands.gamma;
      const hrDrain = Math.max(0, tel.hr_bpm.value - P.stasis.hr_above_bpm) * P.stasis.hr_drain_per_bpm_s;
      let rate = P.stasis.calm_gain_per_s * balance - hrDrain - pressure;
      if (rate > 0 && s.fatigued) rate *= R.fatigue_recovery_mult;
      rate -= world.turretFx?.player_drain ?? 0;
      if (!s.takeover) s.pool = clamp(s.pool + rate * dt, 1, 100);

      bus.publishSim({ stasis: s.pool }, now);
      tel.stasis = bus.resolve("stasis", now, rules.telemetry);
      const stasis = tel.stasis.value;
      const resisting = !!world.ctl.resist;
      const { calm } = resistOf(world.ctl.composure, resisting, bands, rules.lure);
      let stage = s.takeover ? 5 : stageOf(stasis, P.stages);

      // breach timer at S4: steadying (and calm breath sync) slows it; hold long enough to throw it off
      if (stage === 4 && !s.breach && !s.takeover) s.breach = { left: P.breach.seconds, total: P.breach.seconds, held: 0, need: P.breach.resist_hold_s, id: dom?.id ?? null, outcome: null };
      if (s.breach && stage !== 4) s.breach = null;
      let outcome = null;
      if (s.breach) {
        const sync = resisting && calm >= 0.5;
        s.breach.left -= dt * (resisting ? (sync ? P.breach.sync_rate : P.breach.steady_rate) : 1);
        s.breach.held += resisting ? dt : 0;
        s.breach.sync = sync;
        if (s.breach.held >= s.breach.need) {
          outcome = "resisted";
          s.pool = P.breach.success_stasis;
          if (s.breach.id) s.cooldown[s.breach.id] = P.cooldown_s;
          s.breach = null;
          stage = stageOf(s.pool, P.stages);
        } else if (s.breach.left <= 0) {
          outcome = "takeover";
          const t = hostile.find((e) => e.id === s.breach.id) ?? dom;
          s.takeover = { left: P.takeover.seconds, total: P.takeover.seconds, id: t?.id ?? null, bearing: t?.bearing_deg ?? 0 };
          s.pool = 0;
          s.breach = null;
          stage = 5;
        }
      }
      if (s.takeover) {
        const t = world.entities.find((e) => e.id === s.takeover.id);
        if (t) s.takeover.bearing = t.bearing_deg;
        s.takeover.left -= dt;
        if (s.takeover.left <= 0) {
          outcome = "released";
          s.pool = P.takeover.release_stasis;
          if (s.takeover.id) s.cooldown[s.takeover.id] = P.cooldown_s;
          s.takeover = null;
          stage = stageOf(s.pool, P.stages);
        }
      }
      Object.keys(s.cooldown).forEach((k) => { s.cooldown[k] -= dt; if (s.cooldown[k] <= 0) delete s.cooldown[k]; });

      // Rigidity Assist: resistance rises as stasis falls; steadier but stiffer, with a fatigue cap
      const assist = clamp((R.pivot_stasis - stasis) / R.pivot_stasis);
      s.fullAssistS = assist >= 0.99 ? s.fullAssistS + dt : Math.max(0, s.fullAssistS - dt);
      s.fatigued = s.fullAssistS > R.cap_s;
      const reduce = 1 - assist * R.reduce_factor;
      const cost = 1 - assist * R.stiffness_cost;

      const src = s.takeover ? world.entities.find((e) => e.id === s.takeover.id) : dom;
      const prof = (src && P.profiles[src.type]) || P.profiles.default;
      const egregoreClose = src && P.egregore.types.includes(src.type) && src.distance_m <= P.egregore.close_m[scene];
      const eff = egregoreClose ? Math.max(stage, P.egregore.floor_stage) : stage;
      const E = P.stages.find((x) => x.stage === eff);
      const lower = P.stages.find((x) => x.stage === eff)?.min_stasis ?? 0;
      const upper = P.stages.find((x) => x.stage === eff - 1)?.min_stasis ?? 100;
      const depth = clamp((upper - stasis) / Math.max(1, upper - lower));

      const jAmp = rand(E.jitter_deg) * prof.jitter * reduce;
      s.jx = s.jx * 0.85 + (Math.random() - 0.5) * jAmp * 0.6;
      s.jy = s.jy * 0.85 + (Math.random() - 0.5) * jAmp * 0.6;

      let drift = { dx_deg: 0, dy_deg: 0, pull: 0 };
      if (E.drift_gain > 0 && src) {
        const dx = wrap180(src.bearing_deg - tel.imu_yaw.value);
        if (Math.abs(dx) <= FOV_H / 2) {
          const { resist } = resistOf(world.ctl.composure, resisting, bands, rules.lure);
          const pull = clamp(clamp(1 - src.distance_m / range) * E.drift_gain * prof.drift - resist * rules.lure.resist_scale) * reduce;
          drift = { dx_deg: dx * pull * rules.lure.offset_gain, dy_deg: (src.elevation_deg - tel.imu_pitch.value) * pull * rules.lure.offset_gain, pull };
        }
      }
      const lagRange = eff >= prof.lag_from_stage ? (E.lag_ms[1] > 0 ? E.lag_ms : P.stages.find((x) => x.stage === 3).lag_ms) : [0, 0];
      const lag = lerp(lagRange[0], lagRange[1], depth) * prof.lag * reduce;

      if (E.invert) {
        s.nextInvert -= dt;
        if (s.nextInvert <= 0) {
          s.invert = rand(P.invert_burst_s);
          s.nextInvert = rand(P.invert_every_s);
        }
      }
      s.invert = Math.max(0, s.invert - dt);
      if (!E.invert && !s.takeover) s.invert = 0;

      s.falseTags = s.falseTags.map((t) => ({ ...t, ttl: t.ttl - dt })).filter((t) => t.ttl > 0);
      if (Math.random() < E.false_tags_per_s * prof.jitter * dt) {
        s.falseTags.push({ id: ++s.tagSeq, dx_deg: (Math.random() - 0.5) * 70, y: 0.32 + Math.random() * 0.36, ttl: 1.4 });
      }

      let tension = E.tension;
      if (s.takeover) tension = s.takeover.total - s.takeover.left < P.takeover.pulse_s ? 100 : 0;
      const dir = src ? (wrap180(src.bearing_deg - tel.imu_yaw.value) < 0 ? "left" : "right") : null;
      s.fx = {
        stasis: Math.round(stasis * 10) / 10, stage: eff, true_stage: stage, stage_name: E.name, edge: E.edge, cue: E.cue,
        assist: Math.round(assist * 1000) / 1000, fatigued: s.fatigued,
        breach: s.breach && { left: s.breach.left, total: s.breach.total, held: s.breach.held, need: s.breach.need, sync: !!s.breach.sync },
        takeover: s.takeover && { left: s.takeover.left, total: s.takeover.total, id: s.takeover.id },
        outcome,
        jitter: { x: s.jx, y: s.jy }, drift, lag_ms: Math.round(lag), invert: s.invert > 0, ghost_limb: E.ghost_limb,
        input: s.takeover ? "entity" : E.input, move_scale: cost, turn_scale: cost, tension,
        source_id: src?.id ?? null, source_type: src?.type ?? null, steer_yaw: s.takeover ? s.takeover.bearing : null,
        dir, false_tags: s.falseTags, cooldown: Object.keys(s.cooldown), drag_mps: s.takeover ? P.takeover.drag_mps : 0,
        steer_rate: P.takeover.steer_rate,
      };
      return s.fx;
    },
  };
  return api;
}
