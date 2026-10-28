import { useEffect } from "react";

const tone = (ctx, out, { f0, f1 = f0, dur, gain, type = "sine", at = 0 }) => {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.05, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
};

// bone-conduction style cues: stage chime, mastoid tick (false tag), mandible pulse, occipital pressure, breach pulse
const CUE = {
  mandible_pulse: { every: 1.2, play: (c, o) => tone(c, o, { f0: 85, f1: 60, dur: 0.18, gain: 0.5 }) },
  occipital_pressure: { every: 2.6, play: (c, o) => tone(c, o, { f0: 42, f1: 38, dur: 1.1, gain: 0.45, type: "triangle" }) },
  max_pressure: { every: 0.6, play: (c, o) => tone(c, o, { f0: 55, f1: 40, dur: 0.3, gain: 0.6 }) },
  pulse_release: { every: 3, play: (c, o) => tone(c, o, { f0: 70, f1: 30, dur: 2.2, gain: 0.55, type: "triangle" }) },
};

export function usePossessionAudio(frameRef, enabled, volume) {
  useEffect(() => {
    if (!enabled) return undefined;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const out = ctx.createGain();
    out.connect(ctx.destination);
    ctx.resume();
    let raf;
    let stage = frameRef.current.possession?.stage ?? 0;
    let tagSeen = new Set();
    let nextCue = 0;
    const loop = () => {
      const f = frameRef.current.possession;
      out.gain.value = (volume / 100) * 0.8 * (frameRef.current.turret?.cue_scale ?? 1);
      if (f) {
        const now = ctx.currentTime;
        if (f.stage !== stage) {
          const down = f.stage > stage;
          tone(ctx, out, { f0: down ? 520 - f.stage * 60 : 330, f1: down ? 260 - f.stage * 30 : 660, dur: 0.5, gain: 0.25, type: "triangle" });
          stage = f.stage;
          nextCue = now + 0.6;
        }
        f.false_tags.forEach((t) => {
          if (!tagSeen.has(t.id)) {
            tagSeen.add(t.id);
            tone(ctx, out, { f0: 2400, f1: 1800, dur: 0.04, gain: 0.2, type: "square" });
          }
        });
        if (tagSeen.size > 200) tagSeen = new Set();
        const cue = CUE[f.cue];
        if (cue && now >= nextCue && !(f.cue === "pulse_release" && f.tension === 0)) {
          cue.play(ctx, out);
          nextCue = now + cue.every;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ctx.close();
    };
  }, [enabled, volume, frameRef]);
}
