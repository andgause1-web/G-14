import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { API, WS_HUD_URL } from "@/lib/sim";
import { bus, SENSOR_IDS } from "@/lib/telemetry";
import { Recorder, MAX_MS } from "@/lib/recorder";
import { Player, parseSession } from "@/lib/replay";
import { makeEventDetector } from "@/lib/gameEvents";
import { makePossession } from "@/lib/possession";
import { useRules } from "@/lib/rules";

const CHUNK = 2000;
const UI_MS = 33;
const DECK_MS = 200;

export async function uploadSession(rec) {
  const lines = rec.text.split("\n");
  const { data: meta } = await axios.post(`${API}/sessions`, { name: rec.name, notes: rec.notes, scene: rec.scene, duration_ms: rec.duration_ms, line_count: lines.length });
  for (let i = 0; i * CHUNK < lines.length; i++) {
    await axios.post(`${API}/sessions/${meta.id}/chunks`, { idx: i, data: lines.slice(i * CHUNK, (i + 1) * CHUNK).join("\n") });
  }
  return meta;
}

// sim source -> bus -> (replay source) -> resolved channels -> compose frame -> events -> recorder
export function useTelemetryEngine({ scene, sim, compose, controls, setControls, rules, streaming }) {
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const poss = useRef(null);
  if (!poss.current) poss.current = makePossession();
  const rulesRef = useRef(rules);
  rulesRef.current = rules;
  const { version } = useRules();
  const versionRef = useRef(version);
  versionRef.current = version;
  const [frame, setFrame] = useState(() => {
    const now = performance.now();
    const out = sim.step(controls, 0, rules, null);
    bus.publishSim(out.sim, now);
    const tel = bus.resolveAll(SENSOR_IDS, now, rules.telemetry);
    const fx = poss.current.step(0, tel, out.world, rules, { bus, now }, scene === "city" ? "visor" : "corridor");
    const f = compose(out.world, tel, controls, rules, { bus, now }, 0, fx);
    return Object.assign(f, { possession: fx, telemetry: bus.meta(), replay: null, recording: false });
  });
  const frameRef = useRef(frame);
  const stopRef = useRef(null);
  const [deck, setDeck] = useState({ recording: false, recMs: 0, replay: null, events: [] });
  const [streamStatus, setStreamStatus] = useState("off");
  const wsRef = useRef(null);
  const rec = useRef(new Recorder()).current;
  const playerRef = useRef(null);
  const routesRef = useRef(null);
  const eventsRef = useRef([]);
  const detectRef = useRef(makeEventDetector());

  useEffect(() => {
    let raf;
    let lastUi = 0;
    let lastDeck = 0;
    let lastSend = 0;
    let seq = 0;
    let prevNow = performance.now();
    const t0 = prevNow;
    const loop = (now) => {
      const R = rulesRef.current;
      const c = controlsRef.current;
      const P = poss.current;
      const out = sim.step(c, (now - t0) / 1000, R, P.fx());
      bus.publishSim(out.sim, now);
      const player = playerRef.current;
      let world = out.world;
      let game = null;
      if (player) {
        player.advance(now - prevNow);
        player.publish(now, bus);
        ({ world, game } = player.frameAt());
      }
      const dtS = Math.min(0.1, (now - prevNow) / 1000);
      prevNow = now;
      const ctx = { bus, now };
      const tel = bus.resolveAll(SENSOR_IDS, now, R.telemetry);
      let fx;
      if (game?.fx) {
        P.setState(game);
        tel.stasis = bus.resolve("stasis", now, R.telemetry);
        fx = game.fx;
      } else fx = P.step(dtS, tel, world, R, ctx, scene === "city" ? "visor" : "corridor");
      const f = compose(world, tel, c, R, ctx, seq, fx);
      f.possession = fx;
      f.telemetry = bus.meta();
      f.replay = player ? { t_ms: Math.round(player.t), duration_ms: player.duration, playing: player.playing, speed: player.speed } : null;
      f.recording = rec.active;
      detectRef.current(f, now, R.lure.show_threshold).forEach(([type, data]) => {
        rec.event(now, type, data);
        if (!player) eventsRef.current = [{ type, data, k: now + Math.random() }, ...eventsRef.current].slice(0, 30);
      });
      if (!player) rec.tick(now, tel, world, sim.getState(), c, P.getState());
      if (rec.active && rec.elapsed(now) > MAX_MS) {
        toast.warning("Recording hit the 10-minute limit");
        stopRef.current();
      }
      frameRef.current = f;
      const ws = wsRef.current;
      if (now - lastSend > 100) {
        lastSend = now;
        seq += 1;
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ ...f, seq }));
      }
      if (now - lastUi > UI_MS) {
        lastUi = now;
        setFrame(f);
      }
      if (now - lastDeck > DECK_MS) {
        lastDeck = now;
        setDeck({ recording: rec.active, recMs: rec.elapsed(now), replay: f.replay && { ...f.replay, meta: player.s.meta, events: player.s.events }, events: eventsRef.current });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim, compose, rec, scene]);

  useEffect(() => {
    if (!streaming) {
      setStreamStatus("off");
      return undefined;
    }
    setStreamStatus("connecting");
    const ws = new WebSocket(`${WS_HUD_URL}?role=publisher`);
    wsRef.current = ws;
    ws.onopen = () => setStreamStatus("live");
    ws.onerror = () => setStreamStatus("error");
    ws.onclose = () => setStreamStatus((s) => (s === "error" ? s : "off"));
    return () => {
      wsRef.current = null;
      ws.close();
    };
  }, [streaming]);

  const startRecording = useCallback((name, notes) => {
    rec.start({ name, notes, scene, rulesVersion: versionRef.current }, performance.now());
    detectRef.current = makeEventDetector();
  }, [rec, scene]);

  const stopRecording = useCallback(async () => {
    const session = rec.stop(performance.now());
    try {
      await uploadSession(session);
      toast.success(`Session "${session.name}" saved`);
    } catch (e) {
      toast.error(`Could not save session: ${e.message}`);
    }
    return session;
  }, [rec]);
  stopRef.current = stopRecording;

  const loadSession = useCallback((text) => {
    const s = parseSession(text);
    if (s.meta.scene !== scene) throw new Error(`Recorded on ${s.meta.scene} — open that page to replay it`);
    if (rec.active) rec.stop(performance.now());
    if (!routesRef.current) routesRef.current = bus.routeAll("replay");
    const p = new Player(s);
    p.playing = true;
    playerRef.current = p;
    detectRef.current = makeEventDetector();
    return s.meta;
  }, [rec, scene]);

  const eject = useCallback(() => {
    playerRef.current = null;
    if (routesRef.current) bus.restoreRoutes(routesRef.current);
    routesRef.current = null;
    detectRef.current = makeEventDetector();
  }, []);

  // stop replay here and continue live from the recorded state
  const branch = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    const { state } = p.frameAt();
    const recC = p.controlsAt();
    sim.setState(state);
    if (recC) setControls((c) => ({ ...c, ...recC, resetKey: state.resetKey ?? recC.resetKey ?? c.resetKey, keyRun: null, resist: false }));
    eject();
    toast.success(`Branched live at ${(p.t / 1000).toFixed(1)} s`);
  }, [sim, setControls, eject]);

  const transport = {
    play: () => { const p = playerRef.current; if (p) { if (p.t >= p.duration) p.seek(0); p.playing = true; } },
    pause: () => { if (playerRef.current) playerRef.current.playing = false; },
    seek: (t) => playerRef.current?.seek(t),
    setSpeed: (x) => { if (playerRef.current) playerRef.current.speed = x; },
  };

  return { frame, frameRef, streamStatus, deck, startRecording, stopRecording, loadSession, eject, branch, transport };
}
