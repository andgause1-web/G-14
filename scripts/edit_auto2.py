import os
os.chdir("/app")
p = "frontend/src/lib/turret.js"
s = open(p).read()
lines = s.split("\n")
start = lines.index('      const auto = c.turretMode === "auto";')
end = lines.index('      if (auto && mode === "laser" && s.status === "active" && s.cooldown <= 0 && R.turret_confidence.value >= AU.min_conf) s.fireQueued = true;')
NEW = '''      const auto = c.turretMode === "auto";
      const A = T.acoustic;
      const L = T.laser;
      const AU = T.auto;
      const heatF = clamp(1 - (temp - H.throttle_from_c) / (H.max_c - H.throttle_from_c));
      // closing speed measured against the planted turret, not the moving player
      const prevTD = s.prevTD ?? {};
      s.prevTD = {};
      s.tv = {};
      world.entities.forEach((e) => { const d = geo(e).d; s.prevTD[e.id] = d; s.tv[e.id] = dt > 0 && prevTD[e.id] != null ? Math.max(0, (prevTD[e.id] - d) / dt) : 0; });
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
      const toneLock = band ? clamp(1 - Math.abs(hz - band.hz) / A.band_width_hz) : 0;'''
lines[start:end] = NEW.split("\n")
s = "\n".join(lines)
old = "else if ((tgt.approach_mps ?? 0) > L.max_target_mps)"
assert s.count(old) == 1
s = s.replace(old, "else if ((s.tv[tgt.id] ?? 0) > L.max_target_mps)")
open(p, "w").write(s)

import json
rp = "backend/config/rules.json"
r = json.load(open(rp))
r["turret"]["retarget_margin"] = 0.35
json.dump(r, open(rp, "w"), indent=2)

p = "frontend/src/lib/gameEvents.js"
s = open(p).read()
old = '  breach_released: () => "RELEASED",\n};'
assert s.count(old) == 1
s = s.replace(old, '''  breach_released: () => "RELEASED",
  turret_preview: () => "G-13 PREVIEW",
  turret_deploy: (d) => `G-13 DEPLOY @${d.at_m}m`,
  turret_active: () => "G-13 ACTIVE",
  turret_recall: () => "G-13 RECALL",
  turret_target: (d) => `G-13 TARGET ${d.id}`,
  turret_possession_stage: (d) => `G-13 S${d.from}→S${d.to}`,
  turret_turned: () => "G-13 TURNED",
  turret_reclaimed: () => "G-13 RECLAIMED",
  turret_shutdown: () => "G-13 SHUTDOWN",
  turret_down: (d) => `G-13 DOWN ${d.reason}`,
  auto_switch: (d) => `AUTO → ${d.to === "laser" ? "LASER" : "WOLF-TONE"} (${d.reason})`,
  acoustic_on: (d) => `WOLF-TONE ON ${d.hz}Hz`,
  acoustic_off: () => "WOLF-TONE OFF",
  laser_fire: (d) => `LASER ${d.auto ? "AUTO " : ""}${d.result}${d.id ? ` ${d.id}` : ""}`,
  entity_primed: (d) => `PRIMED ${d.id}`,
  entity_stalled: (d) => `STALLED ${d.id}`,
  peltier_on: () => "PELTIER ON",
  peltier_off: () => "PELTIER OFF",
};''')
open(p, "w").write(s)

p = "frontend/src/App.css"
s = open(p).read()
old = ".ts-lock text { fill: rgba(207, 239, 255, 0.7); font-size: 8px; letter-spacing: 0.18em; }"
assert s.count(old) == 1
s = s.replace(old, ".ts-lock text { fill: rgba(207, 239, 255, 0.9); font-size: 10.5px; letter-spacing: 0.16em; paint-order: stroke; stroke: rgba(2, 6, 10, 0.85); stroke-width: 3px; }")
open(p, "w").write(s)
print("ok")
