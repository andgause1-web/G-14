import { useEffect, useState } from "react";
import axios from "axios";
import { X, Copy, Radio } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { API, WS_HUD_URL, copyText } from "@/lib/sim";

const STATUS_TEXT = { off: "OFFLINE", connecting: "CONNECTING", live: "STREAMING", error: "LINK ERROR" };

const Endpoint = ({ label, value, testId }) => (
  <div className="endpoint">
    <div className="micro">{label}</div>
    <div className="endpoint-row">
      <code data-testid={testId}>{value}</code>
      <button className="icon-btn" onClick={() => copyText(value).then(() => toast.success("Copied"))} data-testid={`${testId}-copy`}>
        <Copy size={13} />
      </button>
    </div>
  </div>
);

function useStreamStats(open) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    const load = () => axios.get(`${API}/stream/status`).then((r) => setStats(r.data)).catch(() => setStats(null));
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [open]);
  return stats;
}

export const DataFeed = ({ open, onClose, frame, streaming, setStreaming, streamStatus }) => {
  const stats = useStreamStats(open);
  return (
    <aside className={`drawer drawer-left ${open ? "open" : ""}`} data-testid="data-feed-panel">
      <div className="drawer-head">
        <div><div className="drawer-title">LIVE DATA FEED</div><div className="jp">データフィード · g14.hud.v1</div></div>
        <button className="icon-btn" onClick={onClose} data-testid="data-feed-close-button"><X size={16} /></button>
      </div>
      <div className="drawer-body">
        <label className="ctl-toggle stream-toggle">
          <span><Radio size={14} /> Stream to Unreal</span>
          <Switch data-testid="stream-toggle" checked={streaming} onCheckedChange={setStreaming} />
        </label>
        <div className={`stream-status s-${streamStatus}`} data-testid="stream-status">
          {STATUS_TEXT[streamStatus]}
          {stats && <span> · {stats.subscribers} UNREAL CLIENT{stats.subscribers === 1 ? "" : "S"} · {stats.frames} FRAMES</span>}
        </div>
        <Endpoint label="UNREAL SUBSCRIBER (WebSocket)" value={WS_HUD_URL} testId="endpoint-ws" />
        <Endpoint label="LATEST FRAME (HTTP GET)" value={`${API}/telemetry/latest`} testId="endpoint-http" />
        <div className="group-title">CURRENT MESSAGE</div>
        <pre className="json-feed" data-testid="data-feed-json">{JSON.stringify(frame, null, 2)}</pre>
      </div>
    </aside>
  );
};
