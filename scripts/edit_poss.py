import os
os.chdir('/app/frontend/src')
def ed(p, a, b):
    s=open(p).read(); assert a in s, (p,a[:70]); open(p,'w').write(s.replace(a,b,1))
E='hooks/useTelemetryEngine.js'
ed(E,'import { makeEventDetector } from "@/lib/gameEvents";','import { makeEventDetector } from "@/lib/gameEvents";\nimport { makePossession } from "@/lib/possession";')
ed(E,'''    const now = performance.now();
    const out = sim.step(controls, 0, rules);
    bus.publishSim(out.sim, now);
    const f = compose(out.world, bus.resolveAll(SENSOR_IDS, now, rules.telemetry), controls, rules, { bus, now }, 0);
    return Object.assign(f, { telemetry: bus.meta(), replay: null, recording: false });''','''    const now = performance.now();
    const out = sim.step(controls, 0, rules, null);
    bus.publishSim(out.sim, now);
    const tel = bus.resolveAll(SENSOR_IDS, now, rules.telemetry);
    const fx = poss.step(0, tel, out.world, rules, { bus, now }, scene === "city" ? "visor" : "corridor");
    const f = compose(out.world, tel, controls, rules, { bus, now }, 0, fx);
    return Object.assign(f, { possession: fx, telemetry: bus.meta(), replay: null, recording: false });''')
ed(E,'''  const rulesRef = useRef(rules);''','''  const poss = useRef(null);
  if (!poss.current) poss.current = makePossession();
  const rulesRef = useRef(rules);''')
s=open(E).read()
s=s.replace('const fx = poss.step(0,','const fx = poss.current.step(0,',1)
open(E,'w').write(s)
ed(E,'''      const out = sim.step(c, (now - t0) / 1000, R);
      bus.publishSim(out.sim, now);
      const player = playerRef.current;
      let world = out.world;
      if (player) {
        player.advance(now - prevNow);
        player.publish(now, bus);
        world = player.frameAt().world;
      }
      prevNow = now;
      const tel = bus.resolveAll(SENSOR_IDS, now, R.telemetry);
      const f = compose(world, tel, c, R, { bus, now }, seq);
      f.telemetry = bus.meta();''','''      const P = poss.current;
      const out = sim.step(c, (now - t0) / 1000, R, P.fx());
      bus.publishSim(out.sim, now);
      const player = playerRef.current;
      let world = out.world;
      let game = null;
      if (player) {
        player.advance(now - prevNow);
        player.publish(now, bus);
        ({ world, game } = player.frameAt());
      }
      const dtS = Math.min(0.1, (now - prevNow) / 1000);
      prevNow = now;
      const ctx = { bus, now };
      const tel = bus.resolveAll(SENSOR_IDS, now, R.telemetry);
      let fx;
      if (game?.fx) {
        P.setState(game);
        tel.stasis = bus.resolve("stasis", now, R.telemetry);
        fx = game.fx;
      } else fx = P.step(dtS, tel, world, R, ctx, scene === "city" ? "visor" : "corridor");
      const f = compose(world, tel, c, R, ctx, seq, fx);
      f.possession = fx;
      f.telemetry = bus.meta();''')
ed(E,'''      if (!player) rec.tick(now, tel, world, sim.getState(), c);''','''      if (!player) rec.tick(now, tel, world, sim.getState(), c, P.getState());''')
ed(E,'''  }, [sim, compose, rec]);''','''  }, [sim, compose, rec, scene]);''')

ed('lib/recorder.js','''  tick(now, tel, world, state, controls) {''','''  tick(now, tel, world, state, controls, game) {''')
ed('lib/recorder.js','''    this.lines.push(JSON.stringify({ k: "w", ts, world, state }));''','''    this.lines.push(JSON.stringify({ k: "w", ts, world, state, game }));''')
ed('lib/replay.js','''    return { world: blendWorld(a.world, b?.world, Math.min(1, Math.max(0, f))), state: a.state };''','''    return { world: blendWorld(a.world, b?.world, Math.min(1, Math.max(0, f))), state: a.state, game: a.game };''')

G='lib/gameEvents.js'
ed(G,'''resisting: false, resistStart: 0, peak: 0, lastPull: 0, tier: null };''','''resisting: false, resistStart: 0, peak: 0, lastPull: 0, tier: null, stage: null };''')
ed(G,'''    p.tier = tier;
    return ev;''','''    p.tier = tier;
    const px = frame.possession;
    if (px) {
      if (p.stage != null && px.stage !== p.stage) ev.push(["possession_stage", { from: p.stage, to: px.stage, name: px.stage_name, stasis: px.stasis, source_id: px.source_id }]);
      p.stage = px.stage;
      if (px.outcome) ev.push([`breach_${px.outcome}`, { source_id: px.source_id, stasis: px.stasis }]);
    }
    return ev;''')
ed(G,'''  throttle_tier: (d) => `TIER ${d.from}→${d.to}`,''','''  throttle_tier: (d) => `TIER ${d.from}→${d.to}`,
  possession_stage: (d) => `S${d.from}→S${d.to} ${d.name}`,
  breach_resisted: () => "BREACH RESISTED",
  breach_takeover: (d) => `TAKEOVER ${d.source_id ?? ""}`,
  breach_released: () => "RELEASED",''')

S='lib/sim.js'
ed(S,'export function composeVisor(world, tel, c, rules, { bus, now }, seq) {','export function composeVisor(world, tel, c, rules, { bus, now }, seq, fx) {')
ed(S,'''      stable_zone: stability >= 0.8,
      lure,
    },
  };
}''','''      stable_zone: stability >= 0.8,
      lure,
      reticle: reticleOf(lure, fx),
    },
  };
}

// final reticle offset: luciferic lure + possession drift + tremor jitter
export const reticleOf = (lure, fx) => ({
  dx_deg: r(lure.dx_deg + (fx?.drift.dx_deg ?? 0) + (fx?.jitter.x ?? 0), 3),
  dy_deg: r(lure.dy_deg + (fx?.drift.dy_deg ?? 0) + (fx?.jitter.y ?? 0), 3),
});''')
ed(S,'''    step(c, t0, rules) {
      const t = clock.tick(t0, (s) => { breath = s.breath; last = s.t; });''','''    step(c, t0, rules) {
      const t = clock.tick(t0, (s) => { breath = s.breath; last = s.t; });''')

C='lib/corridor.js'
ed(C,'import { clamp, eegFrom, headMotion, luciferLure, eegChannels, imuChannels, eegFromTel, imuFromTel, bioFromTel, envFromTel, simClock, tierOfLoad } from "@/lib/sim";','import { clamp, eegFrom, headMotion, luciferLure, eegChannels, imuChannels, eegFromTel, imuFromTel, bioFromTel, envFromTel, simClock, tierOfLoad, reticleOf } from "@/lib/sim";')
ed(C,'''    step(c, t0, rules) {''','''    step(c, t0, rules, fx) {''')
ed(C,'''      if (lead <= 0) target = 0;''','''      if (fx && fx.input !== "full" && !auto) target = 0;
      target *= fx?.move_scale ?? 1;
      if (lead <= 0) target = 0;''')
ed(C,'''      } else {
        speed = 0;
        lead += (c.distance - lead) * Math.min(1, dt * 1.6);''','''      } else if (fx?.drag_mps) {
        // takeover: the entity walks you in
        speed = 0;
        lead = Math.max(0, lead - fx.drag_mps * dt);
      } else {
        speed = 0;
        lead += (c.distance - lead) * Math.min(1, dt * 1.6);''')
ed(C,'export function composeCorridor(world, tel, c, rules, { bus, now }, seq) {','export function composeCorridor(world, tel, c, rules, { bus, now }, seq, fx) {')
ed(C,'''      active_tier: c.mode === "throttle" ? obsTier : throttleTier,
      lure,''','''      active_tier: c.mode === "throttle" ? obsTier : throttleTier,
      lure,
      reticle: reticleOf(lure, fx),''')
ed('components/hud/LureCue.jsx','''  const l = frame.hud.lure;
  const x = l ? (l.dx_deg / FOV_H) * window.innerWidth : 0;
  const y = l ? (-l.dy_deg / FOV_V) * window.innerHeight : 0;''','''  const l = frame.hud.lure;
  const rt = frame.hud.reticle;
  const x = (rt.dx_deg / FOV_H) * window.innerWidth;
  const y = (-rt.dy_deg / FOV_V) * window.innerHeight;''')
ed('components/hud/LureCue.jsx','''            <span data-testid="lure-pull">PULL {pct}% · RESIST {Math.round(l.resist * 100)}%</span>''','''            <span className="lure-bars" data-testid="lure-pull" title={`pull ${pct}% · resist ${Math.round(l.resist * 100)}%`}>PULL<i><i style={{ width: `${pct}%` }} /></i>RESIST<i className="rs"><i style={{ width: `${l.resist * 100}%` }} /></i></span>''')
ed('components/hud/LureCue.jsx','''          <span>LURE {pct}%</span>''','''          <span>LURE</span>''')
print('ok')
