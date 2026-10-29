import os
os.chdir("/app")
s = ""


def rep(a, b):
    global s
    assert s.count(a) == 1, a
    s = s.replace(a, b)


def edit(p, pairs):
    global s
    s = open(p).read()
    for a, b in pairs:
        rep(a, b)
    open(p, "w").write(s)


AUTO_BLOCK = '''      const heatF = clamp(1 - (temp - H.throttle_from_c) / (H.max_c - H.throttle_from_c));
      const A = T.acoustic;
      const L = T.laser;

      // AUTO: laser at long range while it can fire, Wolf-Tone once contacts close in or the laser is unavailable
      const AU = T.auto;
      let mode = c.turretMode;
      let autoWhy = null;
      if (auto) {
        if (!target) autoWhy = "no_target";
        else if (geo(target).d <= AU.switch_m) autoWhy = "close";
        else if ((target.approach_mps ?? 0) > L.max_target_mps) autoWhy = "too_fast";
        else if (s.pulses <= 0) autoWhy = "no_pulses";
        else if (heatF < AU.min_heat_factor) autoWhy = "heat";
        else if (s.ign === "failed") autoWhy = "ignition";
        else if (s.cooldown > 0) autoWhy = "cooldown";
        mode = target && !autoWhy ? "laser" : "acoustic";
        if (s.status === "active" && mode !== s.effMode) { log("auto_switch", { to: mode, reason: autoWhy ?? "range" }); s.effMode = mode; }
      } else s.effMode = mode;
      const band = target ? T.resonance[target.type] : null;
      if (auto && band) s.autoHz += Math.sign(band.hz - s.autoHz) * Math.min(Math.abs(band.hz - s.autoHz), AU.sweep_hz_per_s * dt);
      const hz = Math.round(auto ? s.autoHz : c.toneHz);
      const toneLock = band ? clamp(1 - Math.abs(hz - band.hz) / A.band_width_hz) : 0;
      if (auto && mode === "laser" && s.status === "active" && s.cooldown <= 0 && R.turret_confidence.value >= AU.min_conf) s.fireQueued = true;
'''

edit("frontend/src/lib/turret.js", [
    ('ent: {}, pool: 100,', 'ent: {}, autoHz: 528, effMode: null, pool: 100,'),
    ('const rank = (e) => (c.turretMode === "laser" && finishable(e) ? 1000 : 0) + e.score;',
     'const auto = c.turretMode === "auto";\n      const laserPref = c.turretMode === "laser" || (auto && s.cooldown <= 0 && s.pulses > 0);\n      const rank = (e) => (laserPref && finishable(e) ? 1000 : 0) + e.score;'),
    ('      const heatF = clamp(1 - (temp - H.throttle_from_c) / (H.max_c - H.throttle_from_c));\n', AUTO_BLOCK),
    ('const toneOn = s.status === "active" && c.turretMode === "acoustic" && c.turretArmed &&',
     'const toneOn = s.status === "active" && mode === "acoustic" && (auto || c.turretArmed) &&'),
    ('log(toneOn ? "acoustic_on" : "acoustic_off", { hz: c.toneHz }); }\n      const A = T.acoustic;',
     'log(toneOn ? "acoustic_on" : "acoustic_off", { hz }); }'),
    ('clamp(1 - Math.abs(c.toneHz - band.hz) / A.band_width_hz)', 'clamp(1 - Math.abs(hz - band.hz) / A.band_width_hz)'),
    ('      const L = T.laser;\n      s.cooldown', '      s.cooldown'),
    ('if (c.turretMode !== "laser") result', 'if (mode !== "laser") result'),
    ('log("laser_fire", { result,', 'log("laser_fire", { auto, result,'),
    ('mode: c.turretMode, tone_hz: c.toneHz,',
     'mode: c.turretMode, eff_mode: mode, auto, auto_reason: autoWhy, tone_hz: hz, tone_lock: toneLock, lock_band_hz: band?.hz ?? null,'),
    ('ent: s.ent, warn:', 'ent: s.ent, lock_rules: T.tone_lock, warn:'),
])

edit("frontend/src/lib/corridor.js", [('turretMode: "acoustic", toneHz', 'turretMode: "auto", toneHz')])

edit("frontend/src/pages/HallwayPage.jsx", [
    ('turretMode: c.turretMode === "acoustic" ? "laser" : "acoustic"',
     'turretMode: { auto: "laser", laser: "acoustic", acoustic: "auto" }[c.turretMode]'),
])

edit("frontend/src/components/panels/HallwayPanel.jsx", [
    ('{["acoustic", "laser"].map((m) => (', '{["auto", "laser", "acoustic"].map((m) => ('),
    ('{m === "acoustic" ? "WOLF-TONE" : "LASER"}', '{{ auto: "AUTO", acoustic: "WOLF-TONE", laser: "LASER" }[m]}'),
    ('label="Hold tone (acoustic armed)"', 'label="Hold tone (manual Wolf-Tone armed)"'),
    ('Hold T to shut down a possessed turret. M switches mode.',
     'AUTO (default) fires the laser at range to wear resist down, then switches to Wolf-Tone and self-tunes once contacts close in or the laser cannot fire. Hold T to shut down a possessed turret. M cycles AUTO, LASER, WOLF-TONE.'),
])

TONE_LOCK = '''// Tone Lock Assist: ring on the target fills as the Wolf-Tone nears its resonance band, solid when locked
const ToneLock = ({ t, x, y, show }) => {
  const TL = t.lock_rules;
  if (!show || t.status !== "active" || t.eff_mode !== "acoustic" || t.lock_band_hz == null || t.tone_lock < TL.show_from) return null;
  const locked = t.tone_lock >= TL.lock_at;
  const C = 2 * Math.PI * 22;
  const off = t.tone_hz - t.lock_band_hz;
  return (
    <g transform={`translate(${x}, ${y - 34})`} className={`ts-lock ${locked ? "locked" : ""}`} data-testid="tone-lock-ring" data-locked={locked} data-lock={t.tone_lock.toFixed(2)}>
      <circle r="22" className="tl-track" />
      <circle r="22" className="tl-fill" strokeDasharray={C} strokeDashoffset={C * (1 - t.tone_lock)} />
      <text y="36" textAnchor="middle" data-testid="tone-lock-label">{locked ? "TONE LOCK" : `${off > 0 ? "+" : ""}${off}Hz`}</text>
    </g>
  );
};

const Bar = '''

edit("frontend/src/components/corridor/TurretHud.jsx", [
    ('{t.status === "active" ? ` · ${t.mode === "acoustic" ? `${t.tone_hz}Hz` : "LASER"}` : ""}',
     '{t.status === "active" ? ` · ${t.auto ? "AUTO " : ""}${t.eff_mode === "acoustic" ? `${t.tone_hz}Hz` : "LASER"}` : ""}'),
    ('      {t.status === "turned" && <circle', '      <ToneLock t={t} x={tx} y={ty} show={!!tgt} />\n      {t.status === "turned" && <circle'),
    ('const Bar = ', TONE_LOCK),
])

edit("frontend/src/App.css", [('.ts-turned {', '''.ts-lock circle { fill: none; transform: rotate(-90deg); }
.ts-lock .tl-track { stroke: rgba(126, 243, 255, 0.15); stroke-width: 1.5; }
.ts-lock .tl-fill { stroke: rgba(126, 243, 255, 0.75); stroke-width: 2; transition: stroke-dashoffset 300ms ease-out, stroke 300ms ease-out; }
.ts-lock text { fill: rgba(207, 239, 255, 0.7); font-size: 8px; letter-spacing: 0.18em; }
.ts-lock.locked .tl-fill { stroke: #00ff9d; filter: drop-shadow(0 0 5px #00ff9d); }
.ts-lock.locked text { fill: #00ff9d; }
.ts-turned {''')])
print("ok")
