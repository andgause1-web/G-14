import { useEffect, useState } from "react";
import axios from "axios";
import { Copy, Download, FileCode2, Package } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { API, WS_HUD_URL, SCHEMA_FIELDS, copyText } from "@/lib/sim";

const STEPS = [
  "Copy Source/G14Hud into your UE5 project as a module (or merge into your game module and rename G14HUD_API).",
  "Regenerate project files and build in your IDE.",
  "Drop AG14TelemetryReceiver in the level and paste the subscriber URL below into ServerUrl.",
  "Create a Widget Blueprint with parent UG14HudWidget and implement the Update* events.",
  "Back on the Visor page: Data Feed → Stream to Unreal. Press Play in Unreal.",
];

function downloadFile(f) {
  const url = URL.createObjectURL(new Blob([f.content], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = f.name;
  a.click();
  URL.revokeObjectURL(url);
}

const CodeViewer = ({ file }) => (
  <div className="code-viewer" data-testid="code-viewer">
    <div className="code-head">
      <span data-testid="code-viewer-path">{file.path}</span>
      <div className="code-actions">
        <button className="hud-btn" onClick={() => copyText(file.content).then(() => toast.success(`Copied ${file.name}`))} data-testid="code-copy-button"><Copy size={13} /> COPY</button>
        <button className="hud-btn" onClick={() => downloadFile(file)} data-testid="code-download-button"><Download size={13} /> DOWNLOAD</button>
      </div>
    </div>
    <pre className="code-body">
      {file.content.split("\n").map((l, i) => (
        <div key={i} className="code-line"><span className="ln">{i + 1}</span>{l || " "}</div>
      ))}
    </pre>
  </div>
);

export default function UnrealPage() {
  const [files, setFiles] = useState([]);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    axios.get(`${API}/unreal/files`).then((r) => {
      setFiles(r.data);
      const idx = r.data.findIndex((f) => f.name === "G14TelemetryReceiver.cpp");
      setSel(Math.max(0, idx));
    }).catch(() => toast.error("Could not load the Unreal kit"));
  }, []);

  return (
    <div className="unreal-page" data-testid="unreal-page">
      <TopBar />
      <main className="unreal-main">
        <section className="u-hero">
          <div className="eyebrow">UE5 C++ STARTER KIT · アンリアル</div>
          <h1>Rebuild the visor HUD in Unreal.</h1>
          <p>The simulator and the helmet speak one message format. These files receive it over WebSocket, turn it into Blueprint events, and give you a UMG widget base with hooks for every HUD element.</p>
          <a className="hud-btn primary big" href={`${API}/unreal/kit.zip`} data-testid="download-kit-zip-button"><Package size={15} /> DOWNLOAD FULL KIT (.zip)</a>
        </section>

        <section className="u-grid">
          <div className="u-card">
            <div className="group-title">QUICK START</div>
            <ol className="steps">{STEPS.map((s, i) => <li key={i}><span>{String(i + 1).padStart(2, "0")}</span>{s}</li>)}</ol>
          </div>
          <div className="u-card">
            <div className="group-title">ENDPOINTS</div>
            {[["Unreal subscriber (ServerUrl)", WS_HUD_URL, "u-endpoint-ws"], ["Publisher (sim / ESP32)", `${WS_HUD_URL}?role=publisher`, "u-endpoint-pub"], ["HTTP POST frame", `${API}/telemetry`, "u-endpoint-post"], ["HTTP GET latest", `${API}/telemetry/latest`, "u-endpoint-latest"]].map(([l, v, id]) => (
              <div key={id} className="endpoint">
                <div className="micro">{l}</div>
                <div className="endpoint-row"><code data-testid={id}>{v}</code>
                  <button className="icon-btn" onClick={() => copyText(v).then(() => toast.success("Copied"))} data-testid={`${id}-copy`}><Copy size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="u-files">
          <div className="file-list" data-testid="kit-file-list">
            <div className="group-title">FILES</div>
            {files.map((f, i) => (
              <button key={f.path} className={`file-item ${i === sel ? "active" : ""}`} onClick={() => setSel(i)} data-testid={`kit-file-${f.name.replace(/\./g, "-").toLowerCase()}`}>
                <FileCode2 size={13} /><span>{f.path}</span>
              </button>
            ))}
          </div>
          {files[sel] && <CodeViewer file={files[sel]} />}
        </section>

        <section className="u-card">
          <div className="group-title">MESSAGE FORMAT · g14.hud.v1</div>
          <div className="table-wrap">
            <table className="schema-table" data-testid="schema-table">
              <thead><tr><th>Field</th><th>Type</th><th>Unit</th><th>Range</th><th>Sensor</th></tr></thead>
              <tbody>{SCHEMA_FIELDS.map((r) => <tr key={r.field}><td><code>{r.field}</code></td><td>{r.type}</td><td>{r.unit}</td><td>{r.range}</td><td>{r.sensor}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
