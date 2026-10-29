// game events on the session timeline: entity spawn, lure start, resist result, throttle tier change
export function makeEventDetector() {
  const p = { seen: new Set(), lureOn: false, resisting: false, resistStart: 0, peak: 0, lastPull: 0, tier: null, stage: null };
  return (frame, now, thr) => {
    const ev = [];
    frame.scan.entities.forEach((e) => {
      if (!p.seen.has(e.id)) {
        p.seen.add(e.id);
        ev.push(["entity_spawn", { id: e.id, type: e.type, class: e.class, distance_m: e.distance_m }]);
      }
    });
    const l = frame.hud.lure;
    const on = l.pull >= thr;
    if (on && !p.lureOn) ev.push(["lure_start", { target_id: l.target_id, pull: l.pull }]);
    p.lureOn = on;
    if (l.resisting && !p.resisting) {
      p.resistStart = now;
      p.peak = l.pull;
    }
    if (l.resisting) {
      p.peak = Math.max(p.peak, l.pull);
      p.lastPull = l.pull;
    }
    // judged on the last frame while steadying, before the pull rebounds
    if (!l.resisting && p.resisting) {
      ev.push(["resist_result", { result: p.lastPull < thr ? "HELD" : "BROKEN", pull: p.lastPull, peak_pull: p.peak, duration_ms: Math.round(now - p.resistStart) }]);
    }
    p.resisting = l.resisting;
    const tier = frame.hud.active_tier;
    if (p.tier != null && tier !== p.tier) ev.push(["throttle_tier", { from: p.tier, to: tier, cog_load: frame.hud.cognitive_load }]);
    p.tier = tier;
    const px = frame.possession;
    if (px) {
      if (p.stage != null && px.stage !== p.stage) ev.push(["possession_stage", { from: p.stage, to: px.stage, name: px.stage_name, stasis: px.stasis, source_id: px.source_id }]);
      p.stage = px.stage;
      if (px.outcome) ev.push([`breach_${px.outcome}`, { source_id: px.source_id, stasis: px.stasis }]);
    }
    return ev;
  };
}

export const EVENT_LABEL = {
  entity_spawn: (d) => `SPAWN ${d.id}`,
  lure_start: (d) => `LURE ${d.target_id} ${Math.round(d.pull * 100)}%`,
  resist_result: (d) => `RESIST ${d.result}`,
  throttle_tier: (d) => `TIER ${d.from}→${d.to}`,
  possession_stage: (d) => `S${d.from}→S${d.to} ${d.name}`,
  breach_resisted: () => "BREACH RESISTED",
  breach_takeover: (d) => `TAKEOVER ${d.source_id ?? ""}`,
  breach_released: () => "RELEASED",
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
};
