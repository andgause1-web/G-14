import { Crosshair, Target, Shield, Box } from "lucide-react";
import { threatLabel, LOADOUT } from "@/lib/sim";

const LOADOUT_ICONS = { crosshair: Crosshair, target: Target, shield: Shield, box: Box };

export const LoadoutPanel = () => (
  <div className="hud-panel loadout" data-testid="hud-loadout">
    <div className="panel-head">
      <span>06 · LOADOUT</span>
      <span className="jp">装備</span>
    </div>
    <div className="loadout-grid">
      {LOADOUT.map((l) => {
        const Icon = LOADOUT_ICONS[l.icon];
        return (
          <div key={l.key} className={`loadout-slot ${l.active ? "active" : ""}`} data-testid={`loadout-slot-${l.key}`}>
            <span className="slot-key">{l.key}</span>
            <Icon size={16} strokeWidth={1.2} />
            <span className="slot-type">{l.slot}</span>
            <span className="slot-name">{l.name}</span>
          </div>
        );
      })}
    </div>
  </div>
);
import { CymaticRadar } from "./CymaticRadar";
import { CompassRose } from "./DynamicCompass";

export const RadarPanel = ({ frame, frameRef }) => (
  <div className="hud-panel radar" data-testid="hud-cymatic-radar">
    <div className="panel-head">
      <span>04 · CYMATIC RADAR</span>
      <span className="jp">サイマティック</span>
    </div>
    <div className="radar-body">
      <CymaticRadar frameRef={frameRef} />
      <div className="radar-side">
        <CompassRose frame={frame} />
        <div className="micro">RANGE 300 m</div>
        <div className="micro">CONTACTS <b data-testid="radar-contact-count">{frame.scan.entities.length}</b></div>
        <div className="legend"><i className="dot red" />AHRIMANIC</div>
        <div className="legend"><i className="dot cyan" />LUCIFERIC</div>
        <div className="legend"><i className="dot gold" />UNKNOWN</div>
      </div>
    </div>
  </div>
);

const Meter = ({ label, value, tone, testId }) => (
  <div className="meter-row" data-testid={testId}>
    <span>{label}</span>
    <span className="meter-bar"><i className={tone} style={{ width: `${value * 100}%` }} /></span>
    <b>{Math.round(value * 100)}%</b>
  </div>
);

export const TargetReadout = ({ frame }) => {
  const { resonance, stability, entities } = frame.scan;
  const maxThreat = entities.reduce((m, e) => Math.max(m, e.threat), 0);
  const { target_lock, stable_zone } = frame.hud;
  return (
    <div className={`hud-panel target ${target_lock ? "is-lock" : ""}`} data-testid="hud-target-readout">
      <div className="panel-head">
        <span>05 · LISSAJOUS TARGETING</span>
        <span className="jp">標的</span>
      </div>
      <div className={`target-status ${target_lock ? "lock" : ""}`} data-testid="target-lock-status">
        {target_lock ? "TARGET LOCK" : "SCANNING"}
      </div>
      <Meter label="RESONANCE" value={resonance} tone="cyan" testId="target-resonance" />
      <Meter label="STABILITY" value={stability} tone="gold" testId="target-stability" />
      <div className="meter-row">
        <span>THREAT LVL</span>
        <b className={`threat-${threatLabel(maxThreat).toLowerCase()}`} data-testid="target-threat-level">
          {entities.length ? threatLabel(maxThreat) : "NONE"}
        </b>
      </div>
      {stable_zone && (
        <div className="stable-zone" data-testid="stable-zone-indicator">
          REALITY-STABLE ZONE <span className="jp">現実安定域</span>
          <div className="micro">PHASE LOCKED · ANCHOR POINT IDENTIFIED</div>
        </div>
      )}
    </div>
  );
};

const RAIL = ["ENV", "BIO", "COM", "NAV"];

export const StatusRail = ({ frame, throttling }) => {
  const { cognitive_load, throttle_tier } = frame.hud;
  const active = throttling && throttle_tier > 0;
  return (
    <div className="status-rail" data-testid="hud-status-rail">
      <div className="rail-title">RIG</div>
      {RAIL.map((r) => <div key={r} className="rail-item">{r}</div>)}
      <div className="load">
        <div className="micro">COG LOAD</div>
        <div className="load-bar"><i style={{ height: `${cognitive_load * 100}%` }} className={`tier-${throttle_tier}`} /></div>
        <b data-testid="cognitive-load-value">{Math.round(cognitive_load * 100)}</b>
      </div>
      {active && (
        <div className={`throttle-flag tier-${throttle_tier}`} data-testid="observer-throttle-indicator">
          OBSERVER THROTTLE T{throttle_tier}
        </div>
      )}
    </div>
  );
};
