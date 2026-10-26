import { useEffect, useRef } from "react";
import { FOV_H, FOV_V } from "@/lib/sim";

const CITY_IMG =
  "https://static.prod-images.emergentagent.com/jobs/e985c244-e4a3-4446-beff-f722650fda53/images/1b0658b651f13fff440d66889f45d8433b6bfdaf3e0dfa00a2252f42507854aa.jpeg";

export const WorldBackground = ({ frameRef }) => {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    const loop = () => {
      const { yaw_deg, pitch_deg, roll_deg } = frameRef.current.imu;
      const pxX = window.innerWidth / FOV_H;
      const pxY = window.innerHeight / FOV_V;
      const el = ref.current;
      if (el) {
        el.style.backgroundPosition = `calc(50% + ${-yaw_deg * pxX}px) calc(50% + ${pitch_deg * pxY}px)`;
        el.style.transform = `rotate(${-roll_deg}deg) scale(1.12)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [frameRef]);

  return (
    <div className="world-bg-wrap" data-testid="visor-world-background">
      <div ref={ref} className="world-bg" style={{ backgroundImage: `url(${CITY_IMG})` }} />
      <div className="world-tint" />
    </div>
  );
};

export const VisorFrame = ({ overload, scanlines }) => (
  <div className={`visor-frame ${overload ? "is-overload" : ""}`} data-testid="visor-frame">
    {scanlines && <div className="scanlines" data-testid="visor-scanlines" />}
    <div className="visor-vignette" />
    <svg className="visor-mask" viewBox="0 0 1000 1000" preserveAspectRatio="none">
      <path
        fillRule="evenodd"
        fill="#020407"
        d="M0,0 H1000 V1000 H0 Z M40,110 Q500,30 960,110 L990,800 Q500,1000 10,800 Z"
      />
      <path className="visor-edge" d="M40,110 Q500,30 960,110 L990,800 Q500,1000 10,800 Z" fill="none" />
      <path className="visor-strip-red" d="M110,96 Q300,62 480,56" fill="none" />
      <path className="visor-strip-cyan" d="M520,56 Q700,62 890,96" fill="none" />
    </svg>
  </div>
);
