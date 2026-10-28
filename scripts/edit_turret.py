import os
os.chdir('/app/frontend/src')
def ed(p, a, b):
    s=open(p).read(); assert a in s, (p,a[:70]); open(p,'w').write(s.replace(a,b,1))
TU='lib/turret.js'
ed(TU,'''      const alive = world.entities.filter((e) => !s.ent[e.id]?.killed && e.type !== "gnome" || (e.type === "gnome" && e.disposition === "HOSTILE"));''','''      const alive = world.entities.filter((e) => !s.ent[e.id]?.killed && (e.type !== "gnome" || e.disposition === "HOSTILE"));''')
ed(TU,'''      if (s.status === "turned") aim = 180;
      else if (stage === 2) aim += Math.sign(-aim || 1) * TP.drift_dps * 0.2;''','''      // possessed: S1 jitters, S2 drifts toward the player (bearing 0, just ahead of it), S3+ turns on the player
      if (s.status === "turned") aim = 0;
      else if (stage === 2) aim *= 0.4;''')
ed(TU,'''        mode: c.turretMode, tone_hz: c.toneHz,''','''        decoy: !!mod.decoy && deployed, mode: c.turretMode, tone_hz: c.toneHz,''')

C='lib/corridor.js'
ed(C,'''    step(c, t0, rules, fx) {''','''    step(c, t0, rules, fx, tfx) {''')
ed(C,'''.map((e) => buildEntity(e, c, lead, t, eye, TH));''','''.map((e) => buildEntity(e, c, lead, t, eye, TH))
        .filter((e) => !tfx?.ent[e.id]?.killed)
        .map((e) => applyTurret(e, tfx, rules.turret));''')
ed(C,'''export function makeCorridorSim() {''','''// turret control state on a contact: repel push, stall, stagger/primed, lowered resist, thermal decoy
function applyTurret(e, tfx, T) {
  const x = tfx?.ent[e.id];
  if (tfx?.decoy && e.type === "wraith") e.threat = r(e.threat * T.resonance.wraith.decoy_threat_mult);
  if (!x) return e;
  e.distance_m = r(e.distance_m + x.push, 1);
  e.stagger = r(x.stagger, 2);
  e.resist = r(x.resist, 2);
  e.primed = x.stagger >= 1;
  if (x.stall > 0) {
    e.disposition = "STALLED";
    e.threat = r(e.threat * 0.2);
  }
  return e;
}

export function makeCorridorSim() {''')

PO='lib/possession.js'
ed(PO,'''        if (P.egregore.types.includes(e.type)) p *= 1 + P.egregore.contact_scale * (near.length - 1);''','''        if (P.egregore.types.includes(e.type)) p *= 1 + P.egregore.contact_scale * (near.length - 1);
        p *= 1 - (world.turretFx?.ent[e.id]?.damp ?? 0);''')
ed(PO,'''      if (!s.takeover) s.pool = clamp(s.pool + rate * dt, 1, 100);''','''      rate -= world.turretFx?.player_drain ?? 0;
      if (!s.takeover) s.pool = clamp(s.pool + rate * dt, 1, 100);''')

TE='lib/telemetry.js'
ed(TE,'''  { id: "link_status", label: "LINK", unit: "q", min: 0, max: 1, sensor: "ESP32" },''','''  { id: "link_status", label: "LINK", unit: "q", min: 0, max: 1, sensor: "ESP32" },
  { id: "turret_battery", label: "TURRET BATTERY", unit: "%", min: 0, max: 100, sensor: "4S LiPo / INA226" },
  { id: "turret_temp", label: "TURRET TEMP", unit: "°C", min: 15, max: 90, sensor: "Peltier NTC" },
  { id: "turret_heading", label: "TURRET PAN", unit: "°", min: -90, max: 90, sensor: "pan servo" },
  { id: "turret_tilt", label: "TURRET TILT", unit: "°", min: -20, max: 30, sensor: "tilt servo" },
  { id: "turret_confidence", label: "TRACK CONF", unit: "%", min: 0, max: 100, sensor: "TSL1401CL" },
  { id: "turret_ignition_status", label: "IGNITION", unit: "code", min: -2, max: 2, sensor: "FPGA" },
  { id: "turret_link", label: "TURRET LINK", unit: "q", min: 0, max: 1, sensor: "pogo dock" },''')
ed(TE,'''export const SENSOR_IDS = CHANNELS.filter((c) => c.id !== "cog_load" && c.id !== "stasis").map((c) => c.id);''','''export const SENSOR_IDS = CHANNELS.filter((c) => c.id !== "cog_load" && c.id !== "stasis" && !c.id.startsWith("turret_")).map((c) => c.id);''')

E='hooks/useTelemetryEngine.js'
ed(E,'import { makePossession } from "@/lib/possession";','import { makePossession } from "@/lib/possession";\nimport { makeTurret, TURRET_CH } from "@/lib/turret";')
ed(E,'''  if (!poss.current) poss.current = makePossession();''','''  if (!poss.current) poss.current = makePossession();
  const turretRef = useRef(scene === "hallway" ? makeTurret() : null);''')
ed(E,'''      const out = sim.step(c, (now - t0) / 1000, R, P.fx());''','''      const TU = turretRef.current;
      const out = sim.step(c, (now - t0) / 1000, R, P.fx(), TU?.fx());''')
ed(E,'''      let fx;
      if (game?.fx) {''','''      if (TU) world = { ...world, turretFx: TU.fx() };
      let fx;
      if (game?.fx) {''')
ed(E,'''      const f = compose(world, tel, c, R, ctx, seq, fx);
      f.possession = fx;''','''      let tfx = null;
      const turretEvents = [];
      if (TU && game?.turret) {
        TU.setState(game.turret);
        TURRET_CH.forEach((k) => { tel[k] = bus.resolve(k, now, R.telemetry); });
        tfx = TU.fx();
      } else if (TU) {
        const res = TU.step(dtS, tel, world, c, R, ctx);
        tfx = res.fx;
        turretEvents.push(...res.events);
      }
      const f = compose(world, tel, c, R, ctx, seq, fx);
      f.possession = fx;
      f.turret = tfx;''')
ed(E,'''      detectRef.current(f, now, R.lure.show_threshold).forEach(([type, data]) => {''','''      [...turretEvents, ...detectRef.current(f, now, R.lure.show_threshold)].forEach(([type, data]) => {''')
ed(E,'''c, P.getState());''','''c, { ...P.getState(), turret: TU?.getState() ?? null });''')

TH='components/corridor/ThrottleHud.jsx'
ed(TH,'''    <div className="oc-top"><span>{p.e.id} · {p.e.label ?? p.T.name}</span><span>{p.e.stage}</span></div>''','''    <div className="oc-top"><span>{p.e.id} · {p.e.label ?? p.T.name}</span><span>{p.e.primed ? <b className="primed-tag" data-testid={`primed-tag-${p.e.id}`}>PRIMED</b> : p.e.stage}</span></div>''')
ed(TH,'''    <i /> {Math.round(p.e.distance_m)}
  </div>''','''    <i /> {Math.round(p.e.distance_m)}<small className="u-label">m</small>{p.e.primed && <b className="primed-tag" data-testid={`primed-tag-${p.e.id}`}>PRIMED</b>}{p.e.disposition === "STALLED" && <b className="stalled-tag">STALL</b>}
  </div>''')
ed('hooks/usePossessionAudio.js','''      out.gain.value = (volume / 100) * 0.8;''','''      out.gain.value = (volume / 100) * 0.8 * (frameRef.current.turret?.cue_scale ?? 1);''')
print('ok')
