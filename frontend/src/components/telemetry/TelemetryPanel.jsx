import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { bus, CHANNELS, SOURCES } from "@/lib/telemetry";
import { U } from "@/components/telemetry/Units";

const fmt = (v, c) => (c.max - c.min <= 2 ? v.toFixed(3) : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));

const Spark = ({ id }) => {
  const h = bus.hist[id];
  if (h.length < 2) return <svg className="tel-spark" />;
  const min = Math.min(...h);
  const span = Math.max(...h) - min || 1;
  const pts = h.map((v, i) => `${((i / (h.length - 1)) * 100).toFixed(1)},${(17 - ((v - min) / span) * 15).toFixed(1)}`).join(" ");
  return <svg className="tel-spark" viewBox="0 0 100 18" preserveAspectRatio="none" data-testid={`tel-spark-${id}`}><polyline points={pts} /></svg>;
};

const Row = ({ c, m }) => {
  const [, force] = useState(0);
  const ov = bus.override[c.id];
  const setRoute = (s) => { bus.setRoute(c.id, s); force((x) => x + 1); };
  const setOv = (v) => { bus.setOverride(c.id, v); force((x) => x + 1); };
  const route = m?.route ?? bus.route[c.id];
  return (
    <div className={`tel-row ${m?.fallback ? "is-fallback" : ""}`} data-testid={`tel-row-${c.id}`}>
      <div className="tel-head">
        <span className="tel-name">{c.label}<em>{c.sensor}</em></span>
        <b data-testid={`tel-value-${c.id}`}>{m ? fmt(m.value, c) : "—"} <U>{c.unit}</U></b>
      </div>
      <div className="tel-mid">
        <div className="tel-src">
          {SOURCES.map((s) => (
            <button key={s} className={route === s ? "on" : ""} onClick={() => setRoute(s)} data-testid={`tel-source-${c.id}-${s}`}>{s.toUpperCase()}</button>
          ))}
        </div>
        <span className="tel-live" data-testid={`tel-live-source-${c.id}`}>{m?.fallback ? "SIM ⟲" : (m?.source ?? "sim").toUpperCase()}{m?.manual ? " · MAN" : ""}</span>
        <div className="tel-q" title="quality"><i style={{ width: `${(m?.quality ?? 0) * 100}%` }} data-testid={`tel-quality-${c.id}`} /></div>
        <Spark id={c.id} />
      </div>
      {(m?.source ?? "sim") === "sim" && (
        <div className="tel-ov">
          <Switch checked={ov != null} onCheckedChange={(on) => setOv(on ? m?.value ?? c.min : null)} data-testid={`tel-override-toggle-${c.id}`} />
          {ov != null ? (
            <Slider min={c.min} max={c.max} step={(c.max - c.min) / 200} value={[ov]} onValueChange={([v]) => setOv(v)} data-testid={`tel-override-slider-${c.id}`} />
          ) : <span className="micro">manual override</span>}
        </div>
      )}
    </div>
  );
};

export const TelemetryPanel = ({ telemetry }) => (
  <div className="tel-panel" data-testid="telemetry-panel">
    <div className="hint-text">Every HUD value is read from this bus. Pick a source per channel. If a source goes quiet for 500 ms or its quality drops, the channel falls back to SIM and the readout shows a SIM tag. SERIAL is a stub until the suit bridge is wired.</div>
    {CHANNELS.map((c) => <Row key={c.id} c={c} m={telemetry?.[c.id]} />)}
  </div>
);

export const DrawerTabs = ({ tab, setTab }) => (
  <div className="preset-row drawer-tabs">
    <button className={`preset-btn ${tab === "controls" ? "active-cross" : ""}`} onClick={() => setTab("controls")} data-testid="drawer-tab-controls">CONTROLS</button>
    <button className={`preset-btn ${tab === "telemetry" ? "active-cross" : ""}`} onClick={() => setTab("telemetry")} data-testid="drawer-tab-telemetry">TELEMETRY</button>
  </div>
);
