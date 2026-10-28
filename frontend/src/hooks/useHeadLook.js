import { useEffect } from "react";

const IGNORE = "button, input, textarea, select, a, [role='slider'], [role='dialog'], [role='switch'], aside, .tape-deck, .data-feed";
const KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const clampTo = (v, m) => Math.max(-m, Math.min(m, v));

// drag / arrow-key head look; every input passes the possession filter (lag, invert, stiffness, block, takeover)
export function useHeadLook(setControls, frameRef, { yawMax = 180, pitchMax = 30 } = {}) {
  useEffect(() => {
    const held = {};
    let drag = null;
    let raf;
    let last = performance.now();
    const fit = (c, y, p) => ({ ...c, yaw: yawMax >= 180 ? wrap180(y) : clampTo(y, yawMax), pitch: clampTo(p, pitchMax) });
    const turn = (dy, dp) => {
      const f = frameRef.current.possession;
      if (f && f.input !== "full") return;
      const k = (f?.turn_scale ?? 1) * (f?.invert ? -1 : 1);
      const apply = () => setControls((c) => fit(c, c.yaw + dy * k, c.pitch + dp * k));
      if (f?.lag_ms > 0) setTimeout(apply, f.lag_ms);
      else apply();
    };
    const down = (e) => {
      if (e.button !== 0 || e.target.closest(IGNORE)) return;
      drag = { x: e.clientX, y: e.clientY };
    };
    const move = (e) => {
      if (!drag) return;
      turn((e.clientX - drag.x) * 0.12, -(e.clientY - drag.y) * 0.08);
      drag = { x: e.clientX, y: e.clientY };
    };
    const up = () => { drag = null; };
    const kd = (e) => {
      if (!KEYS[e.key] || e.target.closest("input, textarea, [role='slider']")) return;
      e.preventDefault();
      held[e.key] = true;
    };
    const ku = (e) => { if (KEYS[e.key]) held[e.key] = false; };
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      let ry = 0;
      let rp = 0;
      Object.entries(held).forEach(([k, on]) => { if (on) { ry += KEYS[k][0]; rp += KEYS[k][1]; } });
      if (ry || rp) turn(ry * 70 * dt, rp * 40 * dt);
      const f = frameRef.current.possession;
      if (f?.input === "entity" && f.steer_yaw != null) {
        setControls((c) => fit(c, c.yaw + wrap180(f.steer_yaw - c.yaw) * Math.min(1, dt * f.steer_rate), c.pitch * (1 - dt)));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [setControls, frameRef, yawMax, pitchMax]);
}
