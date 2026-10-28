import os
os.chdir('/app/frontend/src')
def ed(p, a, b):
    s=open(p).read(); assert a in s, (p,a[:70]); open(p,'w').write(s.replace(a,b,1))
ed('lib/corridor.js','run: "off", speed: 0, bodyHeight: 178, stance: "stand", keyRun: null, resist: false, bodyAudio: false, bodyVol: 50,','run: "off", speed: 0, bodyHeight: 178, stance: "stand", keyRun: null, resist: false, bodyAudio: false, bodyVol: 50,\n  turretMode: "acoustic", toneHz: 528, turretArmed: true, turretModule: "none", dampen: false, turretCmd: { n: 0 }, turretShutdown: false,')
H='pages/HallwayPage.jsx'
ed(H,'import { PossessionHud } from "@/components/hud/PossessionHud";','import { PossessionHud } from "@/components/hud/PossessionHud";\nimport { TurretScene, TurretStrip, TurretWarning } from "@/components/corridor/TurretHud";')
ed(H,'''// W = walk, +Shift = sprint''','''export const turretCmd = (setControls, type) => setControls((c) => ({ ...c, turretCmd: { n: c.turretCmd.n + 1, type } }));

// G deploy/confirm, F fire laser, M switch mode, hold T to shut the turret down
function useTurretKeys(setControls) {
  useEffect(() => {
    const down = (ev) => {
      if (ev.target.closest("input, textarea")) return;
      const k = ev.key.toLowerCase();
      if (ev.repeat && k !== "t") return;
      if (k === "g") turretCmd(setControls, "deploy");
      else if (k === "f") turretCmd(setControls, "fire");
      else if (k === "m") setControls((c) => ({ ...c, turretMode: c.turretMode === "acoustic" ? "laser" : "acoustic" }));
      else if (k === "t") setControls((c) => (c.turretShutdown ? c : { ...c, turretShutdown: true }));
    };
    const up = (ev) => { if (ev.key.toLowerCase() === "t") setControls((c) => ({ ...c, turretShutdown: false })); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [setControls]);
}

// W = walk, +Shift = sprint''')
ed(H,'''  useRunKeys(controls.run === "manual", setControls, frameRef);''','''  useRunKeys(controls.run === "manual", setControls, frameRef);
  useTurretKeys(setControls);''')
ed(H,'''      <RunVectors frame={frame} />''','''      <RunVectors frame={frame} />
      <TurretScene frame={frame} />''')
ed(H,'''      <PossessionHud frame={frame} />''','''      <PossessionHud frame={frame} />
      <TurretStrip frame={frame} />
      <TurretWarning frame={frame} />''')
P='components/panels/HallwayPanel.jsx'
ed(P,'''        <div className="group-title">ZONE ROOM <span className="jp">区域</span></div>''','''        <div className="group-title">G-13 WOLF-TRAP TURRET <span className="jp">哨戒</span></div>
        <div className="preset-row">
          <button className="preset-btn" onClick={() => setControls((c) => ({ ...c, turretCmd: { n: c.turretCmd.n + 1, type: "deploy" } }))} data-testid="turret-deploy-button">DEPLOY / CONFIRM (G)</button>
          <button className="preset-btn" onClick={() => setControls((c) => ({ ...c, turretCmd: { n: c.turretCmd.n + 1, type: "recall" } }))} data-testid="turret-recall-button">RECALL</button>
        </div>
        <div className="preset-row">
          {["acoustic", "laser"].map((m) => (
            <button key={m} className={`preset-btn ${controls.turretMode === m ? "active-cross" : ""}`} onClick={() => set("turretMode", m)} data-testid={`turret-mode-${m}-button`}>{m === "acoustic" ? "WOLF-TONE" : "LASER"}</button>
          ))}
          <button className="preset-btn" onClick={() => setControls((c) => ({ ...c, turretCmd: { n: c.turretCmd.n + 1, type: "fire" } }))} data-testid="turret-fire-button">FIRE PULSE (F)</button>
        </div>
        {controls.turretMode === "acoustic" && <SliderRow id="toneHz" label="Wolf-tone Hz (golem 528 · pygmy 1400 · wraith 180)" min={60} max={2000} value={controls.toneHz} onChange={set} />}
        <ToggleRow id="turret-armed" label="Hold tone (acoustic armed)" checked={controls.turretArmed} onChange={(v) => set("turretArmed", v)} />
        <ToggleRow id="dampen" label="Dampen (hearing protection, softer bone cues)" checked={controls.dampen} onChange={(v) => set("dampen", v)} />
        <div className="preset-row">
          {[["none", "EMPTY"], ["g12_wide", "WIDE"], ["g12_long", "LONG"], ["g12_decoy", "DECOY"]].map(([k, l]) => (
            <button key={k} className={`preset-btn ${controls.turretModule === k ? "active-cross" : ""}`} onClick={() => set("turretModule", k)} data-testid={`turret-module-${k}-button`}>{l}</button>
          ))}
        </div>
        <div className="hint-text">Drops at your feet: G once for the ghost preview, again to deploy (3 s). Wolf-tone staggers, stalls, repels and lowers resist; the laser only finishes PRIMED or low-resist contacts and aborts above 10 m/s. Hold T to shut down a possessed turret. M switches mode.</div>

        <div className="group-title">ZONE ROOM <span className="jp">区域</span></div>''')
css='''
/* G-13 turret */
.turret-scene { position: absolute; inset: 0; z-index: 5; pointer-events: none; overflow: visible; }
.ts-ghost rect, .ts-ghost ellipse, .ts-ghost path { fill: rgba(0, 240, 255, 0.06); stroke: var(--cyan); stroke-width: 1.2; stroke-dasharray: 4 3; animation: alert-flash 1.6s steps(2) infinite; }
.st-deploying .ts-ghost rect, .st-deploying .ts-ghost ellipse { stroke-dasharray: none; animation: none; }
.ts-deploy { fill: none; stroke: var(--cyan); stroke-width: 2; transform: rotate(-90deg); transition: stroke-dashoffset 120ms linear; }
.ts-cone { fill: rgba(126, 243, 255, 0.07); stroke: rgba(126, 243, 255, 0.35); stroke-width: 1; animation: ts-wave 0.8s ease-in-out infinite; }
@keyframes ts-wave { 0%, 100% { fill-opacity: 0.6; } 50% { fill-opacity: 1.4; } }
.ts-laser { stroke: #ff2a4b; stroke-width: 2; filter: drop-shadow(0 0 6px #ff2a4b); }
.ts-laser.ign-failed, .ts-laser.ign-aborted { stroke: #ffaa00; stroke-dasharray: 6 6; }
.ts-turned { fill: none; stroke: var(--red); stroke-width: 2; animation: alert-flash 0.6s steps(2) infinite; }
.turret-strip { position: absolute; right: 6.5%; bottom: 23%; z-index: 14; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; font-size: 8px; letter-spacing: 0.16em; color: rgba(207, 239, 255, 0.75); --st: rgba(207, 239, 255, 0.5); }
.turret-strip.tone-good { --st: #00ff9d; } .turret-strip.tone-info { --st: var(--cyan); } .turret-strip.tone-bad { --st: var(--red); }
.ts-tag { display: inline-flex; align-items: center; gap: 5px; padding: 2px 6px; border: 1px solid var(--st); color: var(--st); background: rgba(4, 8, 14, 0.6); cursor: default; }
.ts-tag i { width: 5px; height: 5px; border-radius: 50%; background: var(--st); box-shadow: 0 0 6px var(--st); }
.ts-mini { display: flex; gap: 4px; }
.tsb { display: inline-block; width: 40px; height: 2px; background: rgba(0, 240, 255, 0.15); }
.tsb > i { display: block; height: 100%; background: #00ff9d; transition: width 300ms ease; }
.tsb.heat > i { background: #ffaa00; }
.turret-card { position: absolute; bottom: calc(100% + 6px); right: 0; width: 270px; display: grid; grid-template-columns: 74px 1fr; gap: 8px; padding: 8px; background: rgba(4, 8, 14, 0.88); border: 1px solid var(--st); backdrop-filter: blur(14px); opacity: 0; transform: translateY(6px); pointer-events: none; transition: opacity 300ms ease, transform 300ms ease; }
.turret-strip:hover .turret-card { opacity: 1; transform: translateY(0); }
.tc-img { background: #dfe3e6; display: grid; place-items: center; }
.tc-img img { width: 100%; mix-blend-mode: multiply; }
.tc-rows { display: flex; flex-direction: column; gap: 2px; font-size: 8px; }
.tc-rows > span { display: flex; justify-content: space-between; gap: 6px; }
.tc-rows b { font-weight: 400; color: #fff; }
.tc-rows em { font-style: normal; color: #ffaa00; }
.tc-rows .ign-verified { color: #00ff9d; } .tc-rows .ign-failed, .tc-rows .ign-aborted { color: #ffaa00; }
.turret-warn { position: absolute; right: 2.2%; top: 24%; z-index: 14; font-size: 8px; letter-spacing: 0.2em; color: var(--red); text-shadow: 0 0 8px var(--red); writing-mode: vertical-rl; animation: alert-flash 1s steps(2) infinite; }
.primed-tag { margin-left: 5px; padding: 0 4px; font-size: 7px; letter-spacing: 0.16em; color: #0a0a0a; background: #ffaa00; font-weight: 700; }
.stalled-tag { margin-left: 5px; font-size: 7px; letter-spacing: 0.16em; color: var(--cyan); font-weight: 400; }
'''
open('App.css','a').write(css)
print('ok')
