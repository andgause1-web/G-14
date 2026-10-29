# Helper: print turret fx + target-relative distances around turret_target events (usage: python analyze_turret_frames.py NAME [from_ms] [to_ms])
import os
import sys
import json
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
name = sys.argv[1]
t0 = float(sys.argv[2]) if len(sys.argv) > 2 else 0
t1 = float(sys.argv[3]) if len(sys.argv) > 3 else 1e12
s = [x for x in requests.get(f"{BASE}/api/sessions", timeout=20).json() if x.get("name") == name][0]
lines = [json.loads(x) for x in requests.get(f"{BASE}/api/sessions/{s['id']}/jsonl", timeout=30).text.splitlines() if x.strip()]
last = None
for x in lines:
    if x.get("k") != "w":
        continue
    ts = x.get("ts", 0)
    if not (t0 <= ts <= t1):
        continue
    w = x.get("world") or {}
    fx = w.get("turretFx") or {}
    back = fx.get("back_m") or 0
    ents = {e["id"]: e for e in w.get("entities", [])}
    key = (fx.get("target_id"), fx.get("eff_mode"), fx.get("tone_on"), fx.get("auto_reason"))
    if key != last:
        tgt = ents.get(fx.get("target_id"))
        pyg = " ".join(f"{i}:{round(back + e['distance_m'], 1)}/{round(e.get('lane_m') or 0, 1)}" for i, e in ents.items())
        print(ts, key, "lock", fx.get("tone_lock"), "band", fx.get("lock_band_hz"), "back", back, "|", pyg)
        last = key
