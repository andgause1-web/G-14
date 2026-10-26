import { useEffect, useRef } from "react";

export function useCanvasLoop(draw, w, h) {
  const ref = useRef(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const c = ref.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf;
    const t0 = performance.now();
    const loop = (now) => {
      ctx.clearRect(0, 0, w, h);
      drawRef.current(ctx, (now - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [w, h]);

  return ref;
}
