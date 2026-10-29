import { clamp } from "@/lib/sim";
import { stageOf } from "@/lib/possession";

export const TURRET_CH = ["turret_battery", "turret_temp", "turret_heading", "turret_tilt", "turret_confidence", "turret_ignition_status", "turret_link"];
const deg = (rad) => (rad * 180) / Math.PI;
const IGN = { idle: 0, verifying: 1, verified: 2, failed: -1, aborted: -2 };

const fresh = (T) => ({
  status: "stowed", deployLeft: 0, back: 0, dropAt: 0, battery: 100, temp: T.heat.ambient_c, pulses: T.pulse_budget,
  heading: 0, tilt: 0, conf: 0, targetId: null, cooldown: 0, ign: "idle", ignLeft: 0, peltier: false, peltierOn: 0, peltierCd: 0,
  ent: {}, autoHz: 528, effMode: null, pool: 100, pStage: 0, shutdownHeld: 0, cmd: 0, toneOn: false, jit: 0,
});

// G-13 Wolf-Trap: placeable ally; reads the bus, the possession table and rules.turret
export function makeTurret() {
  let s = null;
  let fx = null;
  return {
    getState: () => s && { ...s, ent: JSON.parse(JSON.stringify(s.ent)) },
    setState: (x) => { if (x) { s = { ...x, ent: JSON.parse(JSON.stringify(x.ent)) }; fx = x.fx ?? fx; } },
    fx: () => fx,
    step(dt, tel, world, c, rules, { bus, now }) {
      const T = rules.turret;
      if (!s) s = fresh(T);
      const ev = [];
      const log = (type, data = {}) => ev.push([type, data]);
      const progress = 100 - world.lead_m;
      const mod = T.modules[c.turretModule] ?? T.modules.none;
      const cmd = c.turretCmd ?? { n: 0 };
      if (cmd.n !== s.cmd) {
        s.cmd = cmd.n;
        if (cmd.type === "deploy") {
          if (s.status === "stowed") { s.status = "preview"; log("turret_preview"); }
          else if (s.status === "preview") { s.status = "deploying"; s.deployLeft = T.deploy_s; s.dropAt = progress; log("turret_deploy", { at_m: Math.round(progress) }); }
        } else if (cmd.type === "recall" && s.status !== "stowed") {
          const keep = { battery: s.battery, temp: s.temp, pulses: s.pulses, cmd: s.cmd };
          s = { ...fresh(T), ...keep };
          log("turret_recall");
        } else if (cmd.type === "fire" && s.status === "active") s.fireQueued = true;
      }
      if (s.status === "deploying") {
        s.deployLeft -= dt;
        if (s.deployLeft <= 0) { s.status = "active"; log("turret_active"); }
      }
      const deployed = s.status === "active" || s.status === "turned";
      // signed: negative when you are pushed back past the drop point
      s.back = progress - s.dropAt;

      // resources: battery, heat, Peltier (shuts off first on low battery)
      const H = T.heat;
      const B = T.battery;
      if (deployed || s.status === "deploying") s.battery -= B.idle_per_s * dt;
      const wantPeltier = deployed && s.temp > H.peltier_on_c && s.battery > B.peltier_cutoff_pct && s.peltierCd <= 0;
      if (wantPeltier !== s.peltier) { s.peltier = wantPeltier; log(wantPeltier ? "peltier_on" : "peltier_off", { temp_c: Math.round(s.temp) }); if (!wantPeltier) s.peltierCd = H.peltier_cooldown_s; }
      if (s.peltier) {
        s.peltierOn += dt;
        s.battery -= B.peltier_per_s * dt;
        s.temp -= H.peltier_cool_per_s * dt;
        if (s.peltierOn > H.peltier_max_on_s) { s.peltier = false; s.peltierOn = 0; s.peltierCd = H.peltier_cooldown_s; log("peltier_off", { reason: "duty_limit" }); }
      } else s.peltierCd = Math.max(0, s.peltierCd - dt);
      s.temp = Math.max(H.ambient_c, s.temp - H.passive_cool_per_s * dt);

      // turret possession: egregores in range drain its pool, same stage table as the player
      const P = rules.possession;
      const TP = T.possession;
      const eg = world.entities.filter((e) => P.egregore.types.includes(e.type) && !s.ent[e.id]?.killed && Math.abs(s.back + e.distance_m) <= TP.range_m);
      if (deployed) {
        const drain = eg.reduce((m, e) => m + TP.drain_per_s * e.threat * clamp(1 - Math.abs(s.back + e.distance_m) / TP.range_m), 0);
        s.pool = clamp(s.pool - drain * dt + (c.resist ? TP.resist_gain_per_s * dt : 0) + (eg.length ? 0 : 2 * dt), 0, 100);
        const st = stageOf(s.pool, P.stages);
        if (st !== s.pStage) { log("turret_possession_stage", { from: s.pStage, to: st }); s.pStage = st; }
        if (st >= 3 && s.status === "active") { s.status = "turned"; log("turret_turned"); }
        if (st < 3 && s.status === "turned") { s.status = "active"; log("turret_reclaimed"); }
        s.shutdownHeld = c.turretShutdown ? s.shutdownHeld + dt : 0;
        if (s.shutdownHeld >= TP.shutdown_hold_s) { s.status = "down"; s.downReason = "shutdown"; log("turret_shutdown"); }
      }

      bus.publishSim({
        turret_battery: Math.max(0, s.battery), turret_temp: s.temp, turret_heading: s.heading, turret_tilt: s.tilt,
        turret_confidence: s.conf, turret_ignition_status: IGN[s.ign], turret_link: deployed || s.status === "deploying" ? 1 : 0,
      }, now);
      const R = Object.fromEntries(TURRET_CH.map((k) => [k, bus.resolve(k, now, rules.telemetry)]));
      Object.assign(tel, R);
      const battery = R.turret_battery.value;
      const temp = R.turret_temp.value;
      if (deployed && battery <= 0) { s.status = "down"; s.downReason = "battery"; log("turret_down", { reason: "battery" }); }

      // targeting: highest HUD threat score inside the arc and range
      const cone = T.acoustic.cone_deg * mod.cone_mult;
      const range = T.acoustic.range_m * mod.range_mult;
      const geo = (e) => ({ d: s.back + e.distance_m, b: deg(Math.atan2(e.lane_m ?? 0, s.back + e.distance_m)) });
      const alive = world.entities.filter((e) => !s.ent[e.id]?.killed && (e.type !== "gnome" || e.disposition === "HOSTILE"));
      // laser mode favours contacts it can finish (PRIMED or low resist); otherwise the HUD threat score
      const finishable = (e) => (s.ent[e.id]?.stagger ?? 0) >= 1 || (s.ent[e.id]?.resist ?? 1) < T.laser.finish_resist_below;
      const auto = c.turretMode === "auto";
      const A = T.acoustic;
      const L = T.laser;
      const AU = T.auto;
      const heatF = clamp(1 - (temp - H.throttle_from_c) / (H.max_c - H.throttle_from_c));
      // closing speed measured against the planted turret, not the moving player
      const prevTD = s.prevTD ?? {};
      s.prevTD = {};
      s.tv = {};
      if (deployed) world.entities.forEach((e) => { const d = geo(e).d; s.prevTD[e.id] = d; s.tv[e.id] = dt > 0 && prevTD[e.id] != null ? Math.max(0, (prevTD[e.id] - d) / dt) : 0; });
      const laserPref = c.turretMode === "laser" || (auto && s.cooldown <= 0 && s.pulses > 0);
      // HUD threat score re-based on distance to the turret
      const rank = (e) => (laserPref && finishable(e) ? 1000 : 0) + (e.score * Math.max(1, e.distance_m)) / Math.max(1, geo(e).d);
      // hysteresis: keep the current target unless a rival out-ranks it by retarget_margin
      const pick = (maxD) => {
        const pool = alive.filter((e) => e.disposition !== "NEUTRAL" && Math.abs(geo(e).b) <= T.arc_deg / 2 && geo(e).d > 0 && geo(e).d <= maxD).sort((a, b) => rank(b) - rank(a));
        const cur = pool.find((e) => e.id === s.targetId);
        return cur && pool[0] && rank(pool[0]) < rank(cur) * (1 + T.retarget_margin) ? cur : pool[0] ?? null;
      };
      let target = s.status === "active" ? pick(L.range_m * mod.range_mult) : null;

      // AUTO: laser at long range while it can fire, Wolf-Tone once contacts close in or the laser is unavailable
      let mode = c.turretMode;
      let autoWhy = null;
      if (auto) {
        if (!target) autoWhy = "no_target";
        else if (geo(target).d <= AU.switch_m) autoWhy = "close";
        else if (s.tv[target.id] > L.max_target_mps) autoWhy = "too_fast";
        else if (s.pulses <= 0) autoWhy = "no_pulses";
        else if (heatF < AU.min_heat_factor) autoWhy = "heat";
        else if (s.ign === "failed") autoWhy = "ignition";
        else if (s.cooldown > 0) autoWhy = "cooldown";
        mode = target && !autoWhy ? "laser" : "acoustic";
        // Wolf-Tone can only reach acoustic range: re-pick inside it
        if (mode === "acoustic" && target && geo(target).d > range) target = pick(range) ?? target;
        if (s.status === "active" && mode !== s.effMode) { log("auto_switch", { to: mode, reason: autoWhy ?? "range" }); s.effMode = mode; }
      } else s.effMode = mode;
      if ((target?.id ?? null) !== s.targetId) { s.targetId = target?.id ?? null; if (target) log("turret_target", { id: target.id, type: target.type }); }
      const stage = s.pStage;
      s.jit = stage >= 1 ? (Math.random() - 0.5) * TP.jitter_deg * (stage / 2) : 0;
      let aim = target ? geo(target).b : 0;
      // possessed: S1 jitters, S2 drifts toward the player (bearing 0, just ahead of it), S3+ turns on the player
      if (s.status === "turned") aim = 0;
      else if (stage === 2) aim *= 0.4;
      const err = aim - s.heading;
      s.heading += Math.sign(err) * Math.min(Math.abs(err), T.track_rate_dps * dt) + s.jit;
      s.tilt = target ? deg(Math.atan2(T.tilt_target_m - 0.4, geo(target).d)) : 0;
      s.conf = target ? clamp(T.confidence.base - T.confidence.per_m * geo(target).d - T.confidence.jitter_penalty * Math.abs(s.jit) / 2 - T.confidence.aim_error_penalty * Math.abs(err) + (Math.random() - 0.5) * T.confidence.noise, 0, 100) : 0;
      const conf = R.turret_confidence.value;
      const band = target ? T.resonance[target.type] : null;
      if (auto && band) s.autoHz += Math.sign(band.hz - s.autoHz) * Math.min(Math.abs(band.hz - s.autoHz), AU.sweep_hz_per_s * dt);
      const hz = Math.round(auto ? s.autoHz : c.toneHz);
      const toneLock = band ? clamp(1 - Math.abs(hz - band.hz) / A.band_width_hz) : 0;
      if (auto && mode === "laser" && s.status === "active" && s.cooldown <= 0 && R.turret_confidence.value >= AU.min_conf) s.fireQueued = true;

      // per-entity control state decays
      Object.values(s.ent).forEach((x) => {
        x.stall = Math.max(0, x.stall - dt);
        x.push = Math.max(0, x.push - T.acoustic.push_decay_per_s * dt);
        x.damp = 0;
      });
      const E = (id) => (s.ent[id] ||= { stagger: 0, resist: 1, stall: 0, push: 0, damp: 0, killed: false });

      // acoustic Wolf-Tone: cone beam, damage scales with closeness to each entity's resonance band
      const inCone = alive.filter((e) => { const g = geo(e); return g.d > 0 && g.d <= range && Math.abs(g.b - s.heading) <= cone / 2; });
      const toneOn = s.status === "active" && mode === "acoustic" && (auto || c.turretArmed) && heatF > 0 && battery > 0 && inCone.length > 0;
      if (toneOn !== s.toneOn) { s.toneOn = toneOn; log(toneOn ? "acoustic_on" : "acoustic_off", { hz }); }
      const hit = new Set();
      if (toneOn) {
        s.battery -= B.acoustic_per_s * dt;
        s.temp += H.acoustic_per_s * dt;
        inCone.forEach((e) => {
          const band = T.resonance[e.type];
          let close = band ? clamp(1 - Math.abs(hz - band.hz) / A.band_width_hz) * band.strength * heatF : 0;
          if (band?.decoy_mult && mod.decoy) close *= band.decoy_mult;
          const x = E(e.id);
          if (P.egregore.types.includes(e.type)) x.damp = T.egregore_tone.pull_reduction * clamp(close + T.egregore_tone.strength);
          if (close <= 0) return;
          hit.add(e.id);
          x.stagger = clamp(x.stagger + A.stagger_per_s * close * dt);
          x.resist = clamp(x.resist - A.resist_drop_per_s * close * dt);
          if (band.effect === "stall" && close > 0.5 && x.stall <= 0) { x.stall = band.stall_s; log("entity_stalled", { id: e.id }); }
          if (band.effect === "repel") x.push += A.push_per_s * close * dt;
          if (x.stagger >= 1 && !x.primedLogged) { x.primedLogged = true; log("entity_primed", { id: e.id }); }
        });
      }
      Object.entries(s.ent).forEach(([id, x]) => {
        if (!hit.has(id)) x.stagger = Math.max(0, x.stagger - A.stagger_decay_per_s * dt);
        if (x.stagger < 1) x.primedLogged = false;
      });

      // laser: ignition check, snowball abort > max_target_mps, long cooldown, only finisher
      s.cooldown = Math.max(0, s.cooldown - dt * Math.max(0.25, heatF));
      if (s.ignLeft > 0) { s.ignLeft -= dt; if (s.ignLeft <= 0) s.ign = "idle"; }
      if (s.fireQueued) {
        s.fireQueued = false;
        const tgt = target;
        let result;
        if (mode !== "laser") result = "wrong_mode";
        else if (s.cooldown > 0) result = "cooldown";
        else if (s.pulses <= 0) result = "no_pulses";
        else if (!tgt) result = "no_target";
        else if ((s.tv[tgt.id] ?? 0) > L.max_target_mps) { result = "abort_speed"; s.ign = "aborted"; }
        else {
          s.pulses -= 1;
          s.cooldown = L.cooldown_s;
          s.battery -= B.laser_per_pulse;
          s.temp += H.laser_per_pulse;
          const ok = Math.random() < L.ignition_success * (conf / 100);
          s.ign = ok ? "verified" : "failed";
          const x = E(tgt.id);
          if (!ok) result = "ignition_fail";
          else if (x.stagger >= 1 || x.resist < L.finish_resist_below) { x.killed = true; result = "kill"; }
          else { x.resist = clamp(x.resist - L.damage_unprimed); x.stagger = clamp(x.stagger + L.stagger_add); result = "hit"; }
        }
        s.ignLeft = L.ignition_window_ms / 1000 + 0.6;
        log("laser_fire", { auto, result, id: target?.id ?? null, conf: Math.round(conf) });
      }

      // player coupling: wolf-tone near the player, or a turned turret, drains stasis
      const PL = T.player;
      const near = Math.abs(s.back) <= PL.range_m;
      const damp = c.dampen ? PL.dampen_factor : 1;
      const playerDrain = ((toneOn && near ? PL.stasis_drain_per_s : 0) + (s.status === "turned" ? TP.turned_player_drain_per_s : 0)) * damp;
      const threatNear = world.entities.some((e) => e.disposition === "HOSTILE" && e.distance_m < 30);
      fx = {
        status: s.status, down_reason: s.downReason ?? null, deploy_left: s.deployLeft, deploy_total: T.deploy_s, back_m: Math.round(s.back * 10) / 10,
        decoy: !!mod.decoy && deployed, mode: c.turretMode, eff_mode: mode, auto, auto_reason: autoWhy, tone_hz: hz, tone_lock: toneLock, lock_band_hz: band?.hz ?? null, tone_on: toneOn, module: c.turretModule, module_label: mod.label,
        battery, temp, heading: R.turret_heading.value, tilt: R.turret_tilt.value, confidence: conf, ignition: s.ign,
        link: R.turret_link.value, pulses: s.pulses, cooldown: s.cooldown, peltier: s.peltier, heat_factor: heatF,
        target_id: s.targetId, cone_deg: cone, range_m: range, stage: s.pStage, pool: s.pool, shutdown_held: s.shutdownHeld,
        shutdown_need: TP.shutdown_hold_s, player_drain: playerDrain, dampen: !!c.dampen, cue_scale: c.dampen ? PL.dampen_cue_factor : 1,
        ent: s.ent, lock_rules: T.tone_lock, warn: (s.status === "down" || s.status === "turned") && threatNear,
      };
      s.fx = fx;
      return { fx, events: ev };
    },
  };
}
