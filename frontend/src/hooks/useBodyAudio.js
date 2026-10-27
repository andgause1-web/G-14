import { useEffect, useRef } from "react";

function noiseBuffer(ctx, seconds) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < d.length; i++) {
    b = 0.97 * b + 0.03 * (Math.random() * 2 - 1);
    d[i] = b * 6;
  }
  return buf;
}

function footstep(ctx, out, noise, { speed, stance, side }) {
  const now = ctx.currentTime;
  const prone = stance === "prone";
  const gain = Math.min(1, 0.3 + speed * 0.12) * (stance === "crouch" ? 0.45 : prone ? 0.3 : 1);
  const pan = ctx.createStereoPanner();
  pan.pan.value = side * 0.18;
  pan.connect(out);
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = prone ? "bandpass" : "lowpass";
  f.frequency.value = prone ? 1800 : 520 + speed * 60;
  const g = ctx.createGain();
  const len = prone ? 0.28 : 0.14;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain * 0.9, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + len);
  src.connect(f).connect(g).connect(pan);
  src.start(now, Math.random() * 1.5, len + 0.02);
  if (!prone) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(95, now);
    o.frequency.exponentialRampToValueAtTime(48, now + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(gain * 0.7, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    o.connect(og).connect(pan);
    o.start(now);
    o.stop(now + 0.18);
  }
}

// synthesized footsteps (per run.step) and breathing (follows bio.breath_phase)
export function useBodyAudio(frameRef, enabled, volume) {
  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const volRef = useRef(volume);
  volRef.current = volume;

  useEffect(() => {
    if (!enabled) return undefined;
    if (!ctxRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = ctx.createGain();
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
    }
    const ctx = ctxRef.current;
    const master = masterRef.current;
    ctx.resume();
    const noise = noiseBuffer(ctx, 2);
    const breathSrc = ctx.createBufferSource();
    breathSrc.buffer = noise;
    breathSrc.loop = true;
    const bf = ctx.createBiquadFilter();
    bf.type = "bandpass";
    bf.Q.value = 0.7;
    const bg = ctx.createGain();
    bg.gain.value = 0;
    breathSrc.connect(bf).connect(bg).connect(master);
    breathSrc.start();

    let raf;
    let lastStep = frameRef.current.run?.step ?? 0;
    let side = 1;
    const loop = () => {
      const f = frameRef.current;
      const now = ctx.currentTime;
      master.gain.setTargetAtTime((volRef.current / 100) * 0.7, now, 0.05);
      const s = Math.sin(f.bio?.breath_phase ?? 0);
      const hr = f.bio?.heart_rate_bpm ?? 70;
      const depth = 0.25 + Math.min(1, Math.max(0, (hr - 60) / 70)) * 0.5 + (f.run?.speed_mps ?? 0) * 0.04;
      const env = s > 0 ? s ** 1.6 * depth * 0.55 : (-s) ** 1.6 * depth * 0.75;
      bg.gain.setTargetAtTime(env * 0.35, now, 0.06);
      bf.frequency.setTargetAtTime(s > 0 ? 1500 : 700, now, 0.1);
      const run = f.run;
      if (run && run.step !== lastStep) {
        lastStep = run.step;
        side = -side;
        if (run.speed_mps > 0.15) footstep(ctx, master, noise, { speed: run.speed_mps, stance: run.stance, side });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      breathSrc.stop();
      breathSrc.disconnect();
      ctx.suspend();
    };
  }, [enabled, frameRef]);
}
