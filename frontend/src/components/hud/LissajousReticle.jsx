import { useRef } from "react";
import { useCanvasLoop } from "@/hooks/useCanvasLoop";

const SIZE = 220;

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
  ctx.shadowBlur = 3;
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

const dot = (ctx, c, r) => {
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
};

const CROSSHAIRS = {
  dot: (ctx, c, lock) => dot(ctx, c, lock ? 3.2 : 2.6),
  cross: (ctx, c, lock) => {
    const gap = lock ? 6 : 9;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(c + dx * gap, c + dy * gap);
      ctx.lineTo(c + dx * (gap + 16), c + dy * (gap + 16));
      ctx.stroke();
    });
    dot(ctx, c, 1.8);
  },
  circle: (ctx, c, lock) => {
    ctx.beginPath();
    ctx.arc(c, c, lock ? 9 : 13, 0, Math.PI * 2);
    ctx.stroke();
    dot(ctx, c, 1.6);
  },
};

export const CROSSHAIR_TYPES = Object.keys(CROSSHAIRS);

export const LissajousReticle = ({ frameRef, crosshair, opacity }) => {
  const mix = useRef(0);
  const ref = useCanvasLoop((ctx, t) => {
    const f = frameRef.current;
    const res = f.scan.resonance;
    const lock = f.hud.target_lock;
    const target = f.hud.stable_zone ? 1 : 0;
    mix.current += (target - mix.current) * 0.08;
    const m = mix.current;
    const c = SIZE / 2;
    const a = 1 + Math.floor(res * 4);
    const col = lock ? "#ff2a4b" : "#00f0ff";

    ctx.strokeStyle = "rgba(0,240,255,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c, c, c - 10, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 36; i++) {
      const ang = (i / 36) * Math.PI * 2 + t * 0.1;
      const l = i % 9 === 0 ? 6 : 3;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(ang) * (c - 10), c + Math.sin(ang) * (c - 10));
      ctx.lineTo(c + Math.cos(ang) * (c - 10 - l), c + Math.sin(ang) * (c - 10 - l));
      ctx.stroke();
    }

    const R = c * 0.46 * (1 - m * 0.25);
    drawLissajous(ctx, c, R, a, a + 1, t * 0.6, col, 0.28 * (1 - m * 0.7));
    if (res >= 0.75) drawLissajous(ctx, c, R * 0.8, a + 2, a + 1, -t * 0.4, "#7ef3ff", 0.14 * (1 - m));
    if (m > 0.02) drawMetatron(ctx, c, c * 0.18, t, m * 0.22);

    ctx.save();
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 4;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.5;
    (CROSSHAIRS[crosshair] || CROSSHAIRS.cross)(ctx, c, lock);

    const k = 12;
    const o = lock ? c - 46 : c - 30;
    ctx.globalAlpha = lock ? 0.75 : 0.35;
    ctx.lineWidth = 1.2;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      const x = c + sx * o;
      const y = c + sy * o;
      ctx.beginPath();
      ctx.moveTo(x, y - sy * k);
      ctx.lineTo(x, y);
      ctx.lineTo(x - sx * k, y);
      ctx.stroke();
    });
    ctx.restore();
  }, SIZE, SIZE);

  return <canvas ref={ref} style={{ width: SIZE, height: SIZE, opacity }} data-crosshair={crosshair} data-testid="lissajous-reticle-canvas" />;
};
