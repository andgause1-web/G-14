import os
os.chdir('/app/frontend/src')
def ed(p, a, b):
    s=open(p).read(); assert a in s, (p,a[:70]); open(p,'w').write(s.replace(a,b,1))
T='components/corridor/TurretHud.jsx'
ed(T,'export const TurretStrip = ({ frame }) => {','export const TurretStrip = ({ frame, onDeploy }) => {')
ed(T,'''      <span className="ts-tag" data-testid="turret-status-tag">''','''      <span className="ts-tag" onClick={onDeploy} role="button" title="Loadout slot: click (or G) to preview, again to deploy" data-testid="turret-status-tag">''')
ed('App.css','.ts-tag { display: inline-flex;','.turret-strip { pointer-events: auto; }\n.ts-tag { cursor: pointer; display: inline-flex;')
ed('pages/HallwayPage.jsx','<TurretStrip frame={frame} />','<TurretStrip frame={frame} onDeploy={() => turretCmd(setControls, "deploy")} />')
E='hooks/useTelemetryEngine.js'
ed(E,'''    if (!liveGameRef.current) liveGameRef.current = poss.current.getState();''','''    if (!liveGameRef.current) liveGameRef.current = { poss: poss.current.getState(), turret: turretRef.current?.getState() };''')
ed(E,'''    if (!keepReplayState && liveGameRef.current) poss.current.setState(liveGameRef.current);''','''    if (!keepReplayState && liveGameRef.current) {
      poss.current.setState(liveGameRef.current.poss);
      turretRef.current?.setState(liveGameRef.current.turret);
    }''')
print('ok')
