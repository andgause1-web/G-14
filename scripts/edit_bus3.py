import os
os.chdir('/app/frontend/src')
def ed(p, a, b):
    s=open(p).read(); assert a in s, (p,a[:80]); open(p,'w').write(s.replace(a,b,1))
B='pages/BaselinePage.jsx'
ed(B,'import { envReadings } from "@/lib/corridor";','import { envReadings } from "@/lib/corridor";\nimport { bus } from "@/lib/telemetry";\nimport { useRules } from "@/lib/rules";\nimport { U } from "@/components/telemetry/Units";')
ed(B,'''  { k: "em_ut", key: "em",''','''  { k: "em_ut", ch: "em_field", key: "em",''')
ed(B,'''  { k: "thermal_c", key: "thermal",''','''  { k: "thermal_c", ch: "temp", key: "thermal",''')
ed(B,'''  { k: "imu_jitter_deg", key: "imu",''','''  { k: "imu_jitter_deg", ch: "imu_jitter", key: "imu",''')
ed(B,'''export default function BaselinePage() {''','''export default function BaselinePage() {
  const { rules } = useRules();
  const cfgRef = useRef(null);
  cfgRef.current = rules?.telemetry;
  const [srcs, setSrcs] = useState({});''')
ed(B,'''      const env = envReadings([], t);
      CHANNELS.forEach((c) => {
        const v = env[c.k] + (Math.random() - 0.5) * (c.k === "em_ut" ? 0.6 : c.k === "thermal_c" ? 0.08 : 0.02);
        samples.current[c.k].push(v);''','''      // quiet-room sim source -> bus; the baseline only reads resolved bus values
      const env = envReadings([], t);
      const now = performance.now();
      const noise = (k, a) => env[k] + (Math.random() - 0.5) * a;
      bus.publishSim({ em_field: noise("em_ut", 0.6), temp: noise("thermal_c", 0.08), imu_jitter: noise("imu_jitter_deg", 0.02) }, now);
      const tel = bus.resolveAll(CHANNELS.map((c) => c.ch), now, cfgRef.current);
      setSrcs(Object.fromEntries(CHANNELS.map((c) => [c.key, tel[c.ch].fallback ? "SIM ⟲" : tel[c.ch].source.toUpperCase()])));
      CHANNELS.forEach((c) => {
        const v = tel[c.ch].value;
        samples.current[c.k].push(v);''')
ed(B,'''<div className="micro">{c.sensor}</div></div>''','''<div className="micro">{c.sensor} · <span data-testid={`baseline-source-${c.key}`}>{srcs[c.key] || "BUS"}</span></div></div>''')
ed(B,'''{saved ? <>{saved[c.key].mean} {c.unit}<span>± {saved[c.key].std}</span></> : "—"}''','''{saved ? <>{saved[c.key].mean} <U>{c.unit}</U><span>± {saved[c.key].std} <U>{c.unit}</U></span></> : "—"}''')
ed(B,'''  }, [running, fast]);''','''  }, [running, fast]);
  if (!rules) return <div className="unreal-page" data-testid="rules-loading" />;''')

T='components/telemetry/TapeDeck.jsx'
ed(T,'import { uploadSession } from "@/hooks/useTelemetryEngine";','import { uploadSession } from "@/hooks/useTelemetryEngine";\nimport { parseSession } from "@/lib/replay";')
ed(T,'''      const meta = JSON.parse(text.split("\\n")[0]);
      if (meta.k !== "meta" || !SCENE_PATH[meta.scene]) throw new Error("Not a G-14 session file");
      await uploadSession({ name: meta.name, notes: meta.notes || "", scene: meta.scene, duration_ms: 0, text });''','''      const { meta, duration } = parseSession(text);
      if (!SCENE_PATH[meta.scene]) throw new Error("Unknown scene");
      await uploadSession({ name: meta.name, notes: meta.notes || "", scene: meta.scene, duration_ms: duration, text });''')
css = open('/app/scripts/bus.css').read()
open('App.css','a').write(css)
print('ok')
