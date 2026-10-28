import { FOV_H, FOV_V } from "@/lib/sim";

const SHOW = 0.12;

// shifts the reticle toward the luring entity by hud.lure dx/dy
export const LureWrap = ({ frame, children }) => {
  const l = frame.hud.lure;
  const rt = frame.hud.reticle;
  const x = (rt.dx_deg / FOV_H) * window.innerWidth;
  const y = (-rt.dy_deg / FOV_V) * window.innerHeight;
  return (
    <div className="lure-wrap" style={{ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` }} data-testid="lure-wrap" data-pull={l?.pull ?? 0}>
      {children}
    </div>
  );
};

export const LureCue = ({ frame, tier = 0 }) => {
  const l = frame.hud.lure;
  if (!l) return null;
  const on = l.pull >= SHOW;
  const e = frame.scan.entities.find((x) => x.id === l.target_id);
  const pct = Math.round(l.pull * 100);
  return (
    <>
      <i className={`lure-glow ${l.dx_deg < 0 ? "left" : "right"}`} style={{ opacity: on ? Math.min(0.7, l.pull) : 0 }} data-testid="lure-glow" />
      <div className={`lure-chip obs-fade ${l.dx_deg < 0 ? "side-right" : "side-left"} ${l.resisting ? "resisting" : ""}`} style={{ opacity: on || l.resisting ? 1 : 0 }} data-testid="lure-chip">
        {tier >= 2 ? (
          <span>LURE</span>
        ) : (
          <>
            <b>◇ FALSE LIGHT LURE</b>
            {e && <span data-testid="lure-target">{e.id} · {e.label ?? e.name}</span>}
            <span className="lure-bars" data-testid="lure-pull" title={`pull ${pct}% · resist ${Math.round(l.resist * 100)}%`}>PULL<i><i style={{ width: `${pct}%` }} /></i>RESIST<i className="rs"><i style={{ width: `${l.resist * 100}%` }} /></i></span>
            <span className="lure-hint" data-testid="lure-hint">{l.resisting ? "STEADYING · SLOW BREATH" : "HOLD SPACE TO STEADY"}</span>
          </>
        )}
      </div>
    </>
  );
};
