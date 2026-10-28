import { FOV_H } from "@/lib/sim";

const LIMB = "https://static.prod-images.emergentagent.com/jobs/e985c244-e4a3-4446-beff-f722650fda53/images/67c099e393926b7a52def339abe8c627747072af7e8073827af731443f7af4b9.jpeg";

// edge arcs recolour cyan -> amber -> red with stage; tiny S0-S5 label; S4 brightens toward the egregore
const StageArcs = ({ p }) => (
  <svg className={`poss-arcs st-${p.stage} dir-${p.dir ?? "none"}`} viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ "--edge": p.edge }} data-testid="possession-arcs" data-stage={p.stage}>
    <path className="pa-left" d="M52,170 Q22,470 22,770" />
    <path className="pa-right" d="M948,170 Q978,470 978,770" />
    <path className="pa-bottom" d="M120,830 Q500,975 880,830" />
  </svg>
);

const StageLabel = ({ p }) => (
  <div className="poss-label" style={{ color: p.edge }} data-testid="possession-stage-label">
    S{p.stage}<span>{p.stage_name}</span>{p.stage !== p.true_stage && <em>EGREGORE</em>}
  </div>
);

const Stiffness = ({ p }) => (
  <div className={`stiff-meter ${p.fatigued ? "fatigued" : ""}`} data-testid="stiffness-meter" data-assist={p.assist}>
    <span className="sm-label">STIFF</span>
    <div className="sm-track"><i style={{ height: `${p.assist * 100}%` }} /></div>
    <span className="sm-sub">{p.fatigued ? "FATIGUE" : "ASSIST"}</span>
    <div className="sm-lining" title="Faraday lining tension"><i style={{ width: `${p.tension}%` }} data-testid="lining-tension" /></div>
    <span className="sm-sub">LINING</span>
  </div>
);

// S4 countdown ring around the reticle (no numbers in the centre)
const BreachRing = ({ b }) => {
  const C = 2 * Math.PI * 64;
  const frac = Math.max(0, b.left / b.total);
  const hold = Math.min(1, b.held / b.need);
  return (
    <svg className={`breach-ring ${b.sync ? "sync" : ""}`} viewBox="0 0 160 160" data-testid="breach-ring">
      <circle cx="80" cy="80" r="64" className="br-track" />
      <circle cx="80" cy="80" r="64" className="br-left" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} data-testid="breach-ring-left" />
      <circle cx="80" cy="80" r="56" className="br-hold" strokeDasharray={2 * Math.PI * 56} strokeDashoffset={2 * Math.PI * 56 * (1 - hold)} data-testid="breach-ring-hold" />
    </svg>
  );
};

const FalseTags = ({ tags }) => (
  <>
    {tags.map((t) => (
      <span key={t.id} className="false-tag" style={{ left: `${50 + (t.dx_deg / FOV_H) * 100}%`, top: `${t.y * 100}%`, opacity: Math.min(1, t.ttl) }} data-testid="false-contact-tag">◆ ??</span>
    ))}
  </>
);

export const PossessionHud = ({ frame }) => {
  const p = frame.possession;
  if (!p) return null;
  return (
    <div className={`possession-hud st-${p.stage} ${p.takeover ? "is-takeover" : ""}`} data-testid="possession-hud" data-stage={p.stage}>
      <StageArcs p={p} />
      <StageLabel p={p} />
      <Stiffness p={p} />
      <img src={LIMB} alt="" className="ghost-limb gl-left" style={{ opacity: p.ghost_limb ? 0.6 : 0 }} data-testid="ghost-limb-left" />
      <img src={LIMB} alt="" className="ghost-limb gl-right" style={{ opacity: p.ghost_limb ? 0.5 : 0 }} />
      <FalseTags tags={p.false_tags} />
      {p.breach && <BreachRing b={p.breach} />}
      {p.takeover && <div className="takeover-veil" data-testid="takeover-veil" />}
      {p.invert && <div className="invert-flicker" data-testid="invert-burst" />}
    </div>
  );
};
