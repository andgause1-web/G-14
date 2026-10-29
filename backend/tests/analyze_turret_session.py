# Helper: summarise turret events in a recorded session (usage: python analyze_turret_session.py NAME [--delete])
import os
import sys
import json
import collections
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
name = sys.argv[1]
ss = [s for s in requests.get(f"{BASE}/api/sessions", timeout=20).json() if s.get("name") == name]
for s in ss:
    sid = s["id"]
    txt = requests.get(f"{BASE}/api/sessions/{sid}/jsonl", timeout=30).text
    lines = [json.loads(x) for x in txt.splitlines() if x.strip()]
    ev = [x for x in lines if x.get("k") == "e"]
    frames = [x for x in lines if x.get("k") != "e"]
    print("session", sid, "frames", len(frames), "events", len(ev))
    print(collections.Counter(e.get("type") for e in ev))
    for e in ev:
        if e.get("type", "").startswith(("turret", "auto", "laser", "acoustic", "entity_primed")):
            print(round(e.get("ts", 0), 2), e.get("type"), e.get("data"))
    if "--frames" in sys.argv and frames:
        print("frame keys:", list(frames[0].keys())[:30])
    if "--delete" in sys.argv:
        print("delete", requests.delete(f"{BASE}/api/sessions/{sid}", timeout=20).status_code)
