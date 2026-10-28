// game events on the session timeline: entity spawn, lure start, resist result, throttle tier change
export function makeEventDetector() {
  const p = { seen: new Set(), lureOn: false, resisting: false, resistStart: 0, peak: 0, lastPull: 0, tier: null };
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
    return ev;
  };
}

export const EVENT_LABEL = {
  entity_spawn: (d) => `SPAWN ${d.id}`,
  lure_start: (d) => `LURE ${d.target_id} ${Math.round(d.pull * 100)}%`,
  resist_result: (d) => `RESIST ${d.result}`,
  throttle_tier: (d) => `TIER ${d.from}→${d.to}`,
};
