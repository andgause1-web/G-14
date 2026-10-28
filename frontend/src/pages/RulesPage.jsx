import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, RotateCcw, CheckCircle2 } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useRules } from "@/lib/rules";

const SECTIONS = ["telemetry", "throttle", "cog_load", "lure", "threat"];

function validate(text) {
  const obj = JSON.parse(text);
  const missing = SECTIONS.filter((k) => !(k in obj));
  if (missing.length) throw new Error(`Missing sections: ${missing.join(", ")}`);
  if (!Array.isArray(obj.throttle.observer_tiers)) throw new Error("throttle.observer_tiers must be a list");
  return obj;
}

export default function RulesPage() {
  const { rules, version, save } = useRules();
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (rules && !dirty) setText(JSON.stringify(rules, null, 2));
  }, [rules, version, dirty]);

  const onChange = (v) => {
    setText(v);
    setDirty(true);
    try { validate(v); setError(null); } catch (e) { setError(e.message); }
  };
  const onSave = async () => {
    try {
      await save(validate(text));
      setDirty(false);
      toast.success("Rules saved — HUD updated live");
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    }
  };

  return (
    <div className="unreal-page" data-testid="rules-page">
      <TopBar />
      <main className="unreal-main">
        <section className="u-hero">
          <div className="eyebrow">RULES AS DATA · 規則</div>
          <h1>Throttle, lure and threat rules.</h1>
          <p>The hallway and city scenes only read this config. Saving here writes <code>backend/config/rules.json</code>; editing that file directly also hot-reloads within ~2 s.</p>
          <div className="baseline-actions">
            <button className="hud-btn primary big" onClick={onSave} disabled={!dirty || !!error} data-testid="rules-save-button"><Save size={15} /> SAVE</button>
            <button className="hud-btn big" onClick={() => { setDirty(false); setError(null); }} disabled={!dirty} data-testid="rules-revert-button"><RotateCcw size={15} /> REVERT</button>
            <span className={`rules-status ${error ? "bad" : ""}`} data-testid="rules-status">
              {error ? `INVALID · ${error}` : dirty ? "UNSAVED CHANGES" : <><CheckCircle2 size={13} /> LOADED v{version} · HOT RELOAD ACTIVE</>}
            </span>
          </div>
        </section>
        <section className="u-card">
          <textarea className="rules-editor" spellCheck={false} value={text} onChange={(e) => onChange(e.target.value)} data-testid="rules-editor" />
        </section>
      </main>
    </div>
  );
}
