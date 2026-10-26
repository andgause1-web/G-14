import { useEffect, useRef, useState } from "react";
import { buildFrame, WS_HUD_URL } from "@/lib/sim";

export function useSimulation(controls, streaming) {
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const frameRef = useRef(buildFrame(controls, 0, 0));
  const [frame, setFrame] = useState(frameRef.current);
  const [streamStatus, setStreamStatus] = useState("off");
  const wsRef = useRef(null);

  useEffect(() => {
    let raf;
    let lastUi = 0;
    let lastSend = 0;
    let seq = 0;
    const t0 = performance.now();
    const loop = (now) => {
      const f = buildFrame(controlsRef.current, (now - t0) / 1000, seq);
      frameRef.current = f;
      if (now - lastUi > 33) {
        lastUi = now;
        setFrame(f);
      }
      const ws = wsRef.current;
      if (ws && ws.readyState === 1 && now - lastSend > 100) {
        lastSend = now;
        seq += 1;
        ws.send(JSON.stringify({ ...f, seq }));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

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

  return { frame, frameRef, streamStatus };
}
