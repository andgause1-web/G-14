import os
os.chdir('/app/frontend/src')
def ed(p, a, b, cnt=1):
    s=open(p).read(); assert a in s, (p,a[:80]); open(p,'w').write(s.replace(a,b,cnt))

D='components/hud/DynamicCompass.jsx'
ed(D,'''<b data-testid="compass-heading-value">{String(Math.round(heading) % 360).padStart(3, "0")}°</b>''','''<b data-testid="compass-heading-value">{String(Math.round(heading) % 360).padStart(3, "0")}°<SimTag frame={frame} ch={["imu_yaw", "imu_pitch", "imu_roll"]} /></b>''')
G='components/corridor/GhostHud.jsx'
ed(G,'import ','import { U, SimTag } from "@/components/telemetry/Units";\nimport ')
ed(G,'''    <div className="te-row"><span>SpO₂</span><b>{frame.bio.spo2}%</b></div>
    <div className="te-row"><span>STASIS</span><b>{Math.round(frame.eeg.stasis_index * 100)}</b></div>
    <div className="te-row"><span>COG LOAD</span><b>{Math.round(frame.hud.cognitive_load * 100)}</b></div>
    <div className="te-row"><span>FOCUS</span><b>{frame.hud.focus_ids.length}</b></div>''','''    <div className="te-row"><span>SpO₂</span><b>{frame.bio.spo2}<U>%</U><SimTag frame={frame} ch="spo2" /></b></div>
    <div className="te-row"><span>STASIS</span><b>{Math.round(frame.eeg.stasis_index * 100)}<U>%</U><SimTag frame={frame} ch="stasis" /></b></div>
    <div className="te-row"><span>COG LOAD</span><b>{Math.round(frame.hud.cognitive_load * 100)}<U>%</U><SimTag frame={frame} ch="cog_load" /></b></div>
    <div className="te-row"><span>EM · TEMP</span><b>{frame.env.em_ut}<U>µT</U> {frame.env.thermal_c.toFixed(1)}<U>°C</U><SimTag frame={frame} ch={["em_field", "temp"]} /></b></div>
    <div className="te-row"><span>FOCUS</span><b>{frame.hud.focus_ids.length}<U>TGT</U></b></div>''')
ed(G,'''        <b data-testid="heart-rate-value">{heart_rate_bpm}</b>
      </div>''','''        <b data-testid="heart-rate-value">{heart_rate_bpm}</b><U>BPM</U><SimTag frame={frame} ch="hr_bpm" />
      </div>
      <span className="vc-ring-label" data-testid="vitals-stasis-label">STASIS {Math.round(stasis_index * 100)}<U>%</U></span>''')
T='components/corridor/ThrottleHud.jsx'
ed(T,'<span>STASIS {Math.round(frame.eeg.stasis_index * 100)}</span>','<span>STASIS {Math.round(frame.eeg.stasis_index * 100)}<small className="u-label">%</small></span>')
ed(T,'<span>LOAD {load} · T{tier}</span>','<span>LOAD {load}<small className="u-label">%</small> · T{tier}</span>')
print('ok')
