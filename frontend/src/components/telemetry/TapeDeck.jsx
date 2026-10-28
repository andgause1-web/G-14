import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Circle, Square, FolderOpen, Play, Pause, GitBranch, X, Download, Trash2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { API } from "@/lib/sim";
import { EVENT_LABEL } from "@/lib/gameEvents";
import { uploadSession } from "@/hooks/useTelemetryEngine";
import { parseSession } from "@/lib/replay";

const SCENE_PATH = { city: "/", hallway: "/hallway" };
let pendingText = null;
const mmss = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms / 1000) % 60)).padStart(2, "0")}`;

const download = (name, text) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/x-ndjson" }));
  a.download = `${name.replace(/[^\w-]+/g, "_")}.g14.jsonl`;
  a.click();
  URL.revokeObjectURL(a.href);
};

const RecordDialog = ({ open, onOpenChange, onStart }) => {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => { if (open) setName(`Session ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="g14-dialog" data-testid="record-dialog">
        <DialogHeader><DialogTitle>RECORD SESSION</DialogTitle><DialogDescription>Logs every channel, the encounter state and game events at 10 Hz (max 10 min).</DialogDescription></DialogHeader>
        <label className="g14-field">NAME<Input value={name} onChange={(e) => setName(e.target.value)} data-testid="record-name-input" /></label>
        <label className="g14-field">NOTES<Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What are you testing?" data-testid="record-notes-input" /></label>
        <button className="hud-btn primary" disabled={!name.trim()} onClick={() => { onStart(name.trim(), notes.trim()); onOpenChange(false); }} data-testid="record-start-button"><Circle size={12} /> START RECORDING</button>
      </DialogContent>
    </Dialog>
  );
};

const SessionsDialog = ({ open, onOpenChange, scene, onLoad }) => {
  const [list, setList] = useState([]);
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const refresh = () => axios.get(`${API}/sessions`).then(({ data }) => setList(data)).catch((e) => toast.error(e.message));
  useEffect(() => { if (open) refresh(); }, [open]);
  const fetchText = async (s) => (await axios.get(`${API}/sessions/${s.id}/jsonl`, { responseType: "text", transformResponse: (x) => x })).data;
  const load = async (text, sceneOf) => {
    if (sceneOf !== scene) {
      pendingText = text;
      navigate(SCENE_PATH[sceneOf]);
    } else onLoad(text);
    onOpenChange(false);
  };
  const onImport = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    const text = await file.text();
    try {
      const { meta, duration } = parseSession(text);
      if (!SCENE_PATH[meta.scene]) throw new Error("Unknown scene");
      await uploadSession({ name: meta.name, notes: meta.notes || "", scene: meta.scene, duration_ms: duration, text });
      toast.success(`Imported "${meta.name}"`);
      load(text, meta.scene);
    } catch (e) {
      toast.error(`Import failed: ${e.message}`);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="g14-dialog wide" data-testid="sessions-dialog">
        <DialogHeader><DialogTitle>SESSIONS</DialogTitle><DialogDescription>Recorded runs saved in the app. Load one to replay it on the page where it was recorded.</DialogDescription></DialogHeader>
        <div className="sess-actions">
          <button className="hud-btn" onClick={() => fileRef.current?.click()} data-testid="session-import-button"><Upload size={13} /> IMPORT FILE</button>
          <input ref={fileRef} type="file" accept=".jsonl,.ndjson,.json,.txt" hidden onChange={onImport} data-testid="session-import-input" />
        </div>
        <div className="sess-list">
          {!list.length && <div className="micro">No sessions yet — press REC on the visor.</div>}
          {list.map((s) => (
            <div key={s.id} className="sess-item" data-testid={`session-item-${s.id}`}>
              <div className="sess-main">
                <b>{s.name}</b><span className="sess-scene">{s.scene === "city" ? "VISOR" : "HALLWAY"}</span>
                <div className="micro">{new Date(s.created_at).toLocaleString()} · {mmss(s.duration_ms)} · {s.line_count} lines</div>
                {s.notes && <div className="sess-notes">{s.notes}</div>}
              </div>
              <button className="hud-btn" onClick={async () => load(await fetchText(s), s.scene)} data-testid={`session-load-${s.id}`}><Play size={12} /> LOAD</button>
              <button className="icon-btn" onClick={async () => download(s.name, await fetchText(s))} data-testid={`session-export-${s.id}`}><Download size={14} /></button>
              <button className="icon-btn" onClick={async () => { await axios.delete(`${API}/sessions/${s.id}`); refresh(); }} data-testid={`session-delete-${s.id}`}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Transport = ({ rp, engine }) => {
  const { transport, branch, eject } = engine;
  const pct = (t) => `${(t / Math.max(1, rp.duration_ms)) * 100}%`;
  return (
    <div className="deck-transport" data-testid="replay-transport">
      <button className="icon-btn" onClick={rp.playing ? transport.pause : transport.play} data-testid="replay-play-pause-button">{rp.playing ? <Pause size={14} /> : <Play size={14} />}</button>
      <div className="deck-scrub">
        <input type="range" min={0} max={rp.duration_ms} step={50} value={rp.t_ms} onChange={(e) => transport.seek(Number(e.target.value))} data-testid="replay-scrub" />
        {rp.events.slice(0, 200).map((e, i) => <i key={i} className={`deck-mark ev-${e.type}`} style={{ left: pct(e.ts) }} title={EVENT_LABEL[e.type]?.(e.data)} />)}
      </div>
      <span className="deck-time" data-testid="replay-time">{mmss(rp.t_ms)} / {mmss(rp.duration_ms)}</span>
      {[0.5, 1, 2].map((x) => (
        <button key={x} className={`deck-speed ${rp.speed === x ? "on" : ""}`} onClick={() => transport.setSpeed(x)} data-testid={`replay-speed-${x}`}>{x}×</button>
      ))}
      <button className="hud-btn" onClick={branch} data-testid="replay-branch-button"><GitBranch size={13} /> BRANCH</button>
      <button className="icon-btn" onClick={eject} data-testid="replay-eject-button"><X size={14} /></button>
    </div>
  );
};

export const TapeDeck = ({ engine, scene }) => {
  const [recOpen, setRecOpen] = useState(false);
  const [sessOpen, setSessOpen] = useState(false);
  const { deck, startRecording, stopRecording, loadSession } = engine;
  const tryLoad = (text) => {
    try {
      const meta = loadSession(text);
      toast.success(`Replaying "${meta.name}"`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  useEffect(() => {
    if (pendingText) {
      const t = pendingText;
      pendingText = null;
      tryLoad(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rp = deck.replay;
  return (
    <>
      {rp && <div className="replay-badge" data-testid="replay-badge">● REPLAY <span>{rp.meta?.name}</span> {rp.speed}×</div>}
      {deck.recording && <div className="rec-badge" data-testid="rec-badge">● REC {mmss(deck.recMs)}</div>}
      <div className="tape-deck" data-testid="tape-deck">
        {rp ? <Transport rp={rp} engine={engine} /> : (
          <>
            {deck.recording ? (
              <button className="hud-btn rec-on" onClick={stopRecording} data-testid="record-stop-button"><Square size={12} /> STOP {mmss(deck.recMs)}</button>
            ) : (
              <button className="hud-btn rec" onClick={() => setRecOpen(true)} data-testid="record-button"><Circle size={12} /> REC</button>
            )}
            <button className="hud-btn" onClick={() => setSessOpen(true)} disabled={deck.recording} data-testid="sessions-button"><FolderOpen size={13} /> SESSIONS</button>
          </>
        )}
      </div>
      <RecordDialog open={recOpen} onOpenChange={setRecOpen} onStart={startRecording} />
      <SessionsDialog open={sessOpen} onOpenChange={setSessOpen} scene={scene} onLoad={tryLoad} />
    </>
  );
};
