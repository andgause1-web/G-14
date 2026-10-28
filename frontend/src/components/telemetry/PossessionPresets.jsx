import { Shield, Gauge, Skull } from "lucide-react";
import { U } from "@/components/telemetry/Units";

const ICON = { gentle: Shield, standard: Gauge, brutal: Skull };
const ROWS = [
  ["stasis.entity_drain_per_s", "Entity drain", "/s"],
  ["stasis.calm_gain_per_s", "Calm recovery", "/s"],
  ["breach.seconds", "Breach window", "s"],
  ["breach.resist_hold_s", "Hold to resist", "s"],
  ["takeover.seconds", "Takeover", "s"],
  ["rigidity.reduce_factor", "Assist strength", "×"],
  ["rigidity.cap_s", "Fatigue cap", "s"],
];
const get = (o, path) => path.split(".").reduce((x, k) => x?.[k], o);

// current possession values match a preset's values -> that preset; otherwise hand-edited
const matches = (possession, values) => {
  const walk = (v, cur) => Object.entries(v).every(([k, x]) => (typeof x === "object" ? walk(x, cur?.[k]) : cur?.[k] === x));
  return walk(values, possession);
};

export const PossessionPresets = ({ rules, onApply, disabled, busy }) => {
  const P = rules.possession_presets;
  if (!P) return null;
  const live = Object.keys(P.presets).find((k) => matches(rules.possession, P.presets[k].values));
  return (
    <section className="u-card preset-card" data-testid="possession-presets">
      <div className="pp-head">
        <div className="eyebrow">POSSESSION PRESET · 難易度</div>
        <span className="pp-state" data-testid="possession-preset-active">{live ? `ACTIVE · ${live.toUpperCase()}` : `CUSTOM (from ${P.active.toUpperCase()})`}</span>
      </div>
      <div className="pp-grid">
        {Object.entries(P.presets).map(([name, p]) => {
          const Icon = ICON[name] ?? Gauge;
          return (
            <button key={name} className={`pp-btn pp-${name} ${live === name ? "on" : ""}`} disabled={disabled || busy} onClick={() => onApply(name)} data-testid={`possession-preset-${name}-button`}>
              <span className="pp-title"><Icon size={15} /> {name.toUpperCase()}</span>
              <span className="pp-desc">{p.description}</span>
              <span className="pp-rows">
                {ROWS.map(([path, label, unit]) => (
                  <span key={path} className={get(rules.possession, path) === get(p.values, path) ? "" : "diff"}>{label}<b>{get(p.values, path)}<U>{unit}</U></b></span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {disabled && <div className="micro" data-testid="possession-preset-blocked">Save or revert your editor changes to switch presets.</div>}
    </section>
  );
};
