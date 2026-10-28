import { U, SimTag } from "@/components/telemetry/Units";
import { useCanvasLoop } from "@/hooks/useCanvasLoop";
import { OPERATOR } from "@/lib/sim";

const W = 186;
const H = 30;
const BANDS = [
  { k: "alpha", label: "ALPHA", hz: 10 },
  { k: "beta", label: "BETA", hz: 20 },
  { k: "theta", label: "THETA", hz: 6 },
  { k: "delta", label: "DELTA", hz: 2 },
  { k: "gamma", label: "GAMMA", hz: 40 },
];

const Waveform = ({ frameRef }) => {
  const ref = useCanvasLoop((ctx, t) => {
    const { bands, state } = frameRef.current.eeg;
    const col = state === "UNSTABLE" ? "#ff2a4b" : state === "DRIFTING" ? "#ffaa00" : "#00f0ff";
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 1.5) {
      const s = x / W + t * 0.35;
      let y = 0;
      BANDS.forEach((b) => {
        y += bands[b.k] * Math.sin(2 * Math.PI * b.hz * s * 0.8 + b.hz);
      });
      const py = H / 2 + y * H * 0.9;
      if (x === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.stroke();
  }, W, H);
  return <canvas ref={ref} style={{ width: W, height: H }} data-testid="stasis-waveform-canvas" />;
};

export const StasisMeter = ({ frame, frameRef }) => {
  const { bands, state, stasis_index } = frame.eeg;
  const stable = state === "STABLE";
  return (
    <div className="hud-panel stasis" data-testid="hud-stasis-meter">
      <div className="panel-head">
        <span>01 · STASIS METER <span className="muted">EEG</span></span>
        <span className="jp">停滞計</span>
      </div>
      <div className="stasis-body">
        <div className="stasis-left">
          <div className={`portrait ${stable ? "" : "is-alert"}`} data-testid="operator-portrait">
            <img src={OPERATOR.portrait} alt="Operator portrait" />
            <i className="portrait-scan" />
            <span className="portrait-idx" data-testid="stasis-index-value">{Math.round(stasis_index * 100)}<U>%</U><SimTag frame={frame} ch="stasis" /></span>
          </div>
          <div className="portrait-name" data-testid="operator-callsign">{OPERATOR.callsign}</div>
          <div className="micro">{OPERATOR.rank}</div>
        </div>
        <div className="band-list">
          {BANDS.map((b) => (
            <div key={b.k} className="band-row" data-testid={`eeg-band-${b.k}`}>
              <span className="band-name">{b.label}</span>
              <span className="band-bar"><i style={{ width: `${Math.min(100, bands[b.k] * 160)}%` }} /></span>
              <span className="band-val">{Math.round(bands[b.k] * 100)}<U>%</U><SimTag frame={frame} ch={`eeg_${b.k}`} /></span>
            </div>
          ))}
        </div>
      </div>
      <Waveform frameRef={frameRef} />
      <div className={`stasis-state state-${state.toLowerCase()}`} data-testid="stasis-state">
        CONSCIOUSNESS {state} <span className="jp">{{ STABLE: "意識安定", DRIFTING: "意識漂流", UNSTABLE: "意識不安定" }[state]}</span>
      </div>
    </div>
  );
};
