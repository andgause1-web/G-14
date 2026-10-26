import { Link, useLocation } from "react-router-dom";
import { SlidersHorizontal, Braces, Radio } from "lucide-react";

const Logo = () => (
  <svg viewBox="0 0 40 36" className="logo-mark"><path d="M20 2 L38 34 H2 Z M20 12 L30 30 H10 Z" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
);

export const TopBar = ({ onSensors, onFeed, streamStatus, sensorsLabel = "SENSORS" }) => {
  const { pathname } = useLocation();
  return (
    <header className="topbar" data-testid="top-bar">
      <div className="brand">
        <Logo />
        <div>
          <div className="brand-name">G-14 AETHER WAVE</div>
          <div className="jp">エーテルウェーブ · VISOR SIM</div>
        </div>
      </div>
      <nav className="nav">
        <Link to="/" className={pathname === "/" ? "active" : ""} data-testid="nav-visor-link">VISOR</Link>
        <Link to="/hallway" className={pathname === "/hallway" ? "active" : ""} data-testid="nav-hallway-link">HALLWAY</Link>
        <Link to="/baseline" className={pathname === "/baseline" ? "active" : ""} data-testid="nav-baseline-link">BASELINE</Link>
        <Link to="/unreal" className={pathname === "/unreal" ? "active" : ""} data-testid="nav-unreal-link">UNREAL KIT</Link>
      </nav>
      {onSensors && (
        <div className="actions">
          {streamStatus === "live" && <span className="live-pill" data-testid="topbar-live-indicator"><Radio size={12} /> LIVE</span>}
          <button className="hud-btn" onClick={onFeed} data-testid="open-data-feed-button"><Braces size={14} /> DATA FEED</button>
          <button className="hud-btn primary" onClick={onSensors} data-testid="open-sensor-panel-button"><SlidersHorizontal size={14} /> {sensorsLabel}</button>
        </div>
      )}
    </header>
  );
};
