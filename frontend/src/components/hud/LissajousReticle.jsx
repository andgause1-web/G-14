import { useRef } from "react";
import { useCanvasLoop } from "@/hooks/useCanvasLoop";

const SIZE = 300;

function metatronNodes(r) {
  const pts = [[0, 0]];
  [r, r * 2].forEach((rad) => {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
  });
  return pts;
}

function drawMetatron(ctx, c, r, t, alpha) {
  const nodes = metatronNodes(r);
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(t * 0.12);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(229,193,88,0.85)";
  ctx.shadowColor = "rgba(229,193,88,0.9)";
  ctx.shadowBlur = 10;
  ctx.lineWidth = 0.9;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      ctx.beginPath();
      ctx.moveTo(nodes[i][0], nodes[i][1]);
      ctx.lineTo(nodes[j][0], nodes[j][1]);
      ctx.stroke();
    }
  }
  nodes.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

function drawLissajous(ctx, c, R, a, b, phase, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= 600; i++) {
    const t = (i / 600) * Math.PI * 2;
    const x = c + Math.sin(a * t + phase) * R;
    const y = c + Math.sin(b * t) * R;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

export const LissajousReticle = ({ frameRef }) => {
  const mix = useRef(0);
  const ref = useCanvasLoop((ctx, t) => {
    const f = frameRef.current;
    const res = f.scan.resonance;
    const lock = f.hud.target_lock;
    const target = f.hud.stable_zone ? 1 : 0;
    mix.current += (target - mix.current) * 0.04;
    const m = mix.current;
    const c = SIZE / 2;
    const a = 1 + Math.floor(res * 4);
    const col = lock ? "#ff2a4b" : "#00f0ff";

    ctx.strokeStyle = "rgba(0,240,255,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c, c, c - 14, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 72; i++) {
      const ang = (i / 72) * Math.PI * 2 + t * 0.1;
      const l = i % 6 === 0 ? 9 : 4;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(ang) * (c - 14), c + Math.sin(ang) * (c - 14));
      ctx.lineTo(c + Math.cos(ang) * (c - 14 - l), c + Math.sin(ang) * (c - 14 - l));
      ctx.stroke();
    }

    const R = c * 0.52 * (1 - m * 0.25);
    drawLissajous(ctx, c, R, a, a + 1, t * 0.6, col, 1 - m * 0.75);
    if (res >= 0.75) drawLissajous(ctx, c, R * 0.8, a + 2, a + 1, -t * 0.4, "#7ef3ff", 0.5 * (1 - m));
    if (m > 0.02) drawMetatron(ctx, c, c * 0.2, t, m);

    const k = 26;
    const o = c - 42;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      const x = c + sx * o;
      const y = c + sy * o;
      ctx.beginPath();
      ctx.moveTo(x, y - sy * k);
      ctx.lineTo(x, y);
      ctx.lineTo(x - sx * k, y);
      ctx.stroke();
    });
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(c, c, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }, SIZE, SIZE);

  return <canvas ref={ref} style={{ width: SIZE, height: SIZE }} data-testid="lissajous-reticle-canvas" />;
};
