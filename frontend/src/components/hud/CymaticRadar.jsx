import { useMemo } from "react";
import { useCanvasLoop } from "@/hooks/useCanvasLoop";
import { wrap180 } from "@/lib/sim";

const SIZE = 140;
const RES = 96;
const MODES = [[1, 2], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5], [4, 5], [3, 7], [5, 6], [4, 7]];
const MAX_RANGE_DEFAULT = 300;

const chladni = (x, y, n, m) =>
  Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) - Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y);

function drawField(off, res, stab, t) {
  const octx = off.getContext("2d");
  const img = octx.createImageData(RES, RES);
  const f = res * (MODES.length - 1) + Math.sin(t * 0.35) * 0.45;
  const i0 = Math.max(0, Math.min(MODES.length - 2, Math.floor(f)));
  const k = Math.min(1, Math.max(0, f - i0));
  const [n0, m0] = MODES[i0];
  const [n1, m1] = MODES[i0 + 1];
  const sharp = 6 + stab * 14;
  const rot = t * 0.08;
  for (let py = 0; py < RES; py++) {
    for (let px = 0; px < RES; px++) {
      const ux = (px / (RES - 1)) * 2 - 1;
      const uy = (py / (RES - 1)) * 2 - 1;
      if (ux * ux + uy * uy > 1) continue;
      const x = ux * Math.cos(rot) - uy * Math.sin(rot);
      const y = ux * Math.sin(rot) + uy * Math.cos(rot);
      const v = chladni(x, y, n0, m0) * (1 - k) + chladni(x, y, n1, m1) * k;
      const a = Math.exp(-Math.abs(v) * sharp);
      const idx = (py * RES + px) * 4;
      img.data[idx] = 40 + a * 120;
      img.data[idx + 1] = 200 + a * 55;
      img.data[idx + 2] = 255;
      img.data[idx + 3] = a * 210;
    }
  }
  octx.putImageData(img, 0, 0);
}

export const CymaticRadar = ({ frameRef, maxRange = MAX_RANGE_DEFAULT }) => {
  const off = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = RES;
    c.height = RES;
    return c;
  }, []);

  const ref = useCanvasLoop((ctx, t) => {
    const f = frameRef.current;
    const R = SIZE / 2 - 6;
    const cx = SIZE / 2;
    drawField(off, f.scan.resonance, f.scan.stability, t);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(off, cx - R, cx - R, R * 2, R * 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(0,240,255,0.45)";
    ctx.lineWidth = 1;
    [1, 0.66, 0.33].forEach((s) => {
      ctx.beginPath();
      ctx.arc(cx, cx, R * s, 0, Math.PI * 2);
      ctx.stroke();
    });
    for (let a = 0; a < 360; a += 10) {
      const rad = (a * Math.PI) / 180;
      const l = a % 90 === 0 ? 8 : 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(rad) * R, cx - Math.cos(rad) * R);
      ctx.lineTo(cx + Math.sin(rad) * (R + l), cx - Math.cos(rad) * (R + l));
      ctx.stroke();
    }
    const sweep = (t * 1.4) % (Math.PI * 2);
    const g = ctx.createConicGradient(sweep - Math.PI / 2 - 0.6, cx, cx);
    g.addColorStop(0, "rgba(0,240,255,0)");
    g.addColorStop(0.095, "rgba(0,240,255,0.28)");
    g.addColorStop(0.1, "rgba(0,240,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cx, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cx - 8);
    ctx.lineTo(cx - 5, cx + 5);
    ctx.lineTo(cx + 5, cx + 5);
    ctx.closePath();
    ctx.fillStyle = "#e5c158";
    ctx.fill();
    f.scan.entities.forEach((e) => {
      const ang = (wrap180(e.bearing_deg - f.imu.yaw_deg) * Math.PI) / 180;
      const d = Math.min(e.distance_m / maxRange, 1) * R;
      const col = e.color || (e.class === "AHRIMANIC" ? "255,42,75" : e.class === "LUCIFERIC" ? "126,243,255" : "229,193,88");
      const x = cx + Math.sin(ang) * d;
      const y = cx - Math.cos(ang) * d;
      const pulse = 3 + Math.sin(t * 5 + d) * 1.2;
      ctx.fillStyle = `rgba(${col},0.95)`;
      ctx.shadowColor = `rgba(${col},1)`;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }, SIZE, SIZE);

  return <canvas ref={ref} style={{ width: SIZE, height: SIZE }} data-testid="cymatic-radar-canvas" />;
};
