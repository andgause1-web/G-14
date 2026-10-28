import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Play, RotateCcw, CheckCircle2 } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { Switch } from "@/components/ui/switch";
import { envReadings } from "@/lib/corridor";
import { bus } from "@/lib/telemetry";
import { useRules } from "@/lib/rules";
import { U } from "@/components/telemetry/Units";
import { useCanvasLoop } from "@/hooks/useCanvasLoop";

const DURATION = 60;
const CHANNELS = [
  { k: "em_ut", ch: "em_field", key: "em", label: "EM FIELD", unit: "µT", sensor: "TSL1401CL / EM", color: "#00f0ff" },
  { k: "thermal_c", ch: "temp", key: "thermal", label: "THERMAL", unit: "°C", sensor: "THERMAL", color: "#ffaa00" },
  { k: "imu_jitter_deg", ch: "imu_jitter", key: "imu", label: "IMU JITTER", unit: "°", sensor: "BMI270", color: "#00ff9d" },
];

const stats = (arr) => {
  const mean = arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
  const std = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, arr.length));
  return { mean: Math.round(mean * 1000) / 1000, std: Math.round(std * 1000) / 1000 };
};

const Spark = ({ samples, color }) => {
  const ref = useCanvasLoop((ctx) => {
    const s = samples.current;
    if (s.length < 2) return;
    const min = Math.min(...s);
    const max = Math.max(...s) + 1e-6;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    s.slice(-300).forEach((v, i, a) => {
      const x = (i / (a.length - 1)) * 520;
      const y = 50 - ((v - min) / (max - min)) * 40;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, 520, 56);
  return <canvas ref={ref} style={{ width: 520, height: 56 }} />;
};

export default function BaselinePage() {
  const { rules } = useRules();
  const cfgRef = useRef(null);
  cfgRef.current = rules?.telemetry;
  const [srcs, setSrcs] = useState({});
  const [running, setRunning] = useState(false);
  const [fast, setFast] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem("g14.baseline") || "null"));
  const samples = useRef(Object.fromEntries(CHANNELS.map((c) => [c.k, []])));
  const live = useRef(Object.fromEntries(CHANNELS.map((c) => [c.k, { current: [] }])));

  useEffect(() => {
    if (!running) return undefined;
    const t0 = performance.now();
    const speed = fast ? 10 : 1;
    const id = setInterval(() => {
      const t = ((performance.now() - t0) / 1000) * speed;
      // quiet-room sim source -> bus; the baseline only reads resolved bus values
      const env = envReadings([], t);
      const now = performance.now();
      const noise = (k, a) => env[k] + (Math.random() - 0.5) * a;
      bus.publishSim({ em_field: noise("em_ut", 0.6), temp: noise("thermal_c", 0.08), imu_jitter: noise("imu_jitter_deg", 0.02) }, now);
      const tel = bus.resolveAll(CHANNELS.map((c) => c.ch), now, cfgRef.current);
      setSrcs(Object.fromEntries(CHANNELS.map((c) => [c.key, tel[c.ch].fallback ? "SIM ⟲" : tel[c.ch].source.toUpperCase()])));
      CHANNELS.forEach((c) => {
        const v = tel[c.ch].value;
        samples.current[c.k].push(v);
        live.current[c.k].current = samples.current[c.k];
      });
      setElapsed(Math.min(DURATION, t));
      if (t >= DURATION) {
        clearInterval(id);
        setRunning(false);
        const b = { recorded_at: new Date().toISOString(), samples: samples.current.em_ut.length };
        CHANNELS.forEach((c) => { b[c.key] = stats(samples.current[c.k]); });
        localStorage.setItem("g14.baseline", JSON.stringify(b));
        setSaved(b);
      }
    }, 100);
    return () => clearInterval(id);
  }, [running, fast]);
  if (!rules) return <div className="unreal-page" data-testid="rules-loading" />;

  const start = () => {
    CHANNELS.forEach((c) => { samples.current[c.k] = []; live.current[c.k].current = []; });
    setElapsed(0);
    setRunning(true);
  };
  const clear = () => { localStorage.removeItem("g14.baseline"); setSaved(null); setElapsed(0); };

  return (
    <div className="unreal-page" data-testid="baseline-page">
      <TopBar />
      <main className="unreal-main">
        <section className="u-hero">
          <div className="eyebrow">CALIBRATION · 較正</div>
          <h1>Record a 60-second baseline.</h1>
          <p>Stand still in a quiet room. The suit samples EM, thermal and head-motion noise, then the hallway HUD only flags deviations from this baseline.</p>
          <div className="baseline-actions">
            <button className="hud-btn primary big" onClick={start} disabled={running} data-testid="baseline-start-button"><Play size={15} /> {running ? "RECORDING…" : "START BASELINE"}</button>
            <button className="hud-btn big" onClick={clear} data-testid="baseline-clear-button"><RotateCcw size={15} /> CLEAR</button>
            <label className="ctl-toggle fast-toggle"><span>Fast (6 s, testing)</span><Switch checked={fast} onCheckedChange={setFast} disabled={running} data-testid="baseline-fast-toggle" /></label>
          </div>
          <div className="baseline-progress" data-testid="baseline-progress"><i style={{ width: `${(elapsed / DURATION) * 100}%` }} /><span>{Math.floor(elapsed)} / {DURATION} s</span></div>
        </section>
        <section className="u-card">
          {CHANNELS.map((c) => (
            <div key={c.k} className="baseline-row" data-testid={`baseline-channel-${c.key}`}>
              <div><div className="group-title" style={{ color: c.color }}>{c.label}</div><div className="micro">{c.sensor} · <span data-testid={`baseline-source-${c.key}`}>{srcs[c.key] || "BUS"}</span></div></div>
              <Spark samples={live.current[c.k]} color={c.color} />
              <div className="baseline-stat">{saved ? <>{saved[c.key].mean} <U>{c.unit}</U><span>± {saved[c.key].std} <U>{c.unit}</U></span></> : "—"}</div>
            </div>
          ))}
        </section>
        {saved && (
          <section className="u-card baseline-done" data-testid="baseline-result">
            <CheckCircle2 size={18} /> BASELINE STABLE · {saved.samples} samples · {new Date(saved.recorded_at).toLocaleTimeString()}
            <Link to="/hallway" className="hud-btn" data-testid="baseline-goto-hallway">OPEN HALLWAY</Link>
          </section>
        )}
      </main>
    </div>
  );
}
