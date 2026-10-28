import { SimTag } from "@/components/telemetry/Units";
const CARD = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW" };
const PX = 6;
const TICKS = Array.from({ length: 145 }, (_, i) => i * 5 - 360);

const norm = (d) => ((d % 360) + 360) % 360;

export const DynamicCompass = ({ frame }) => {
  const { yaw_deg, pitch_deg, roll_deg } = frame.imu;
  const heading = norm(yaw_deg);
  return (
    <div className="compass" data-testid="hud-dynamic-compass">
      <div className="compass-strip">
        <div className="compass-track" style={{ transform: `translateX(${-yaw_deg * PX}px)` }}>
          {TICKS.map((d) => {
            const n = norm(d);
            const major = n % 15 === 0;
            return (
              <div key={d} className={`tick ${major ? "major" : ""}`} style={{ left: d * PX }}>
                {major && <span className={CARD[n] ? "card" : ""}>{CARD[n] || n}</span>}
              </div>
            );
          })}
        </div>
        <div className="compass-needle" />
      </div>
      <div className="compass-read">
        <span>PITCH {pitch_deg.toFixed(1)}°</span>
        <b data-testid="compass-heading-value">{String(Math.round(heading) % 360).padStart(3, "0")}°<SimTag frame={frame} ch={["imu_yaw", "imu_pitch", "imu_roll"]} /></b>
        <span>ROLL {roll_deg.toFixed(1)}°</span>
      </div>
      <div className="jp center">動的コンパス · BMI270</div>
    </div>
  );
};

export const CompassRose = ({ frame }) => (
  <svg viewBox="-50 -50 100 100" className="compass-rose" data-testid="compass-rose">
    <circle r="44" className="rose-ring" />
    <circle r="30" className="rose-ring dim" />
    <g style={{ transform: `rotate(${-frame.imu.yaw_deg}deg)` }} className="rose-dial">
      {Object.entries(CARD).map(([deg, l]) => (
        <text key={deg} transform={`rotate(${deg}) translate(0,-35)`} className={l === "N" ? "rose-n" : ""}>
          {l.length === 1 ? l : ""}
        </text>
      ))}
      <path d="M0,-28 L4,0 L0,28 L-4,0 Z" className="rose-needle" />
    </g>
  </svg>
);
