import { ENTITY_TYPES, BOSS_DISTANCE, CORRIDOR_LENGTH } from "@/lib/corridor";

export const CorridorProgress = ({ frame, interval }) => {
  const marks = Array.from({ length: CORRIDOR_LENGTH / interval + 1 }, (_, i) => i * interval);
  const pct = (d) => `${(d / CORRIDOR_LENGTH) * 100}%`;
  return (
    <div className="cor-progress" data-testid="corridor-progress">
      <div className="cp-head">
        <span>CORRIDOR · 100 m</span>
        <b data-testid="corridor-lead-distance">LEAD {Math.round(frame.lead_m)} m</b>
      </div>
      <div className="cp-track">
        {marks.map((m) => (
          <span key={m} className="cp-mark" style={{ left: pct(m) }}><i>{m}</i></span>
        ))}
        {frame.scan.entities.map((e) => (
          <span key={e.id} className={`cp-dot ${e.type === "boss" ? "boss" : ""}`} style={{ left: pct(e.distance_m), background: ENTITY_TYPES[e.type].color }} />
        ))}
        <span className="cp-op" style={{ left: 0 }} title="Operator" />
        <span className="cp-lead" style={{ left: pct(Math.min(frame.lead_m, BOSS_DISTANCE)) }} />
      </div>
    </div>
  );
};

export const EventLog = ({ events }) => (
  <div className="hud-panel event-log" data-testid="corridor-event-log">
    <div className="panel-head">
      <span>07 · EVENT LOG</span>
      <span className="jp">記録</span>
    </div>
    {events.length === 0 && <div className="ev-row muted">AWAITING CONTACT…</div>}
    {events.map((ev) => (
      <div key={ev.k} className={`ev-row ev-${ev.tone}`}>
        <span className="ev-d">{String(Math.round(ev.d)).padStart(3, "0")}m</span>
        <span>{ev.text}</span>
      </div>
    ))}
  </div>
);
