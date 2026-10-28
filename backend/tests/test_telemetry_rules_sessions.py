# Rules config (hot reload) + recorded sessions API tests
import copy
import json
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def original_rules(s):
    r = s.get(f"{API}/rules")
    assert r.status_code == 200
    orig = r.json()["rules"]
    yield orig
    # restore
    rr = s.put(f"{API}/rules", json={"rules": orig})
    assert rr.status_code == 200


# --- Rules ---
class TestRules:
    def test_get_rules(self, s, original_rules):
        d = s.get(f"{API}/rules").json()
        assert set(d) >= {"rules", "version"}
        assert isinstance(d["version"], int)
        for k in ["telemetry", "throttle", "cog_load", "lure", "threat"]:
            assert k in d["rules"]
        assert d["rules"]["telemetry"]["timeout_ms"] == 500

    def test_put_missing_section_400(self, s, original_rules):
        bad = copy.deepcopy(original_rules)
        bad.pop("lure")
        r = s.put(f"{API}/rules", json={"rules": bad})
        assert r.status_code == 400
        assert "lure" in r.json()["detail"]

    def test_put_bad_tiers_400(self, s, original_rules):
        for tiers in ["x", [], [{"tier": 0}], [1, 2]]:
            bad = copy.deepcopy(original_rules)
            bad["throttle"]["observer_tiers"] = tiers
            r = s.put(f"{API}/rules", json={"rules": bad})
            assert r.status_code == 400, tiers

    def test_put_throttle_not_dict_400(self, s, original_rules):
        bad = copy.deepcopy(original_rules)
        bad["throttle"] = "nope"
        r = s.put(f"{API}/rules", json={"rules": bad})
        assert r.status_code == 400

    def test_put_non_object_422(self, s):
        r = s.put(f"{API}/rules", json={"rules": [1, 2]})
        assert r.status_code in (400, 422)

    def test_put_valid_changes_version_and_file(self, s, original_rules):
        v0 = s.get(f"{API}/rules").json()["version"]
        time.sleep(0.05)
        mod = copy.deepcopy(original_rules)
        mod["throttle"]["observer_tiers"][1]["min_load"] = 41
        r = s.put(f"{API}/rules", json={"rules": mod})
        assert r.status_code == 200
        d = r.json()
        assert d["version"] != v0
        assert d["rules"]["throttle"]["observer_tiers"][1]["min_load"] == 41
        g = s.get(f"{API}/rules").json()
        assert g["rules"]["throttle"]["observer_tiers"][1]["min_load"] == 41
        assert g["version"] == d["version"]


# --- Sessions ---
class TestSessions:
    sid = None

    def test_create_session(self, s):
        r = s.post(f"{API}/sessions", json={"name": "TEST_sess", "notes": "TEST notes", "scene": "hallway", "duration_ms": 1234, "line_count": 3})
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "TEST_sess" and d["scene"] == "hallway" and d["size"] == 0
        assert isinstance(d["id"], str)
        TestSessions.sid = d["id"]

    def test_create_validation(self, s):
        r = s.post(f"{API}/sessions", json={"name": "TEST_x"})
        assert r.status_code == 422

    def test_chunks_out_of_order_joined(self, s):
        sid = TestSessions.sid
        meta = json.dumps({"k": "meta", "schema": "g14.session.v1", "name": "TEST_sess", "scene": "hallway"})
        r1 = s.post(f"{API}/sessions/{sid}/chunks", json={"idx": 1, "data": "line2\nline3"})
        r0 = s.post(f"{API}/sessions/{sid}/chunks", json={"idx": 0, "data": meta})
        assert r1.status_code == 200 and r0.status_code == 200
        assert r0.json() == {"ok": True}
        t = s.get(f"{API}/sessions/{sid}/jsonl")
        assert t.status_code == 200
        assert t.text == meta + "\nline2\nline3"
        assert "ndjson" in t.headers.get("content-type", "")

    def test_list_and_scene_filter(self, s):
        sid = TestSessions.sid
        all_ = s.get(f"{API}/sessions").json()
        item = next(x for x in all_ if x["id"] == sid)
        assert item["notes"] == "TEST notes"
        assert item["size"] > 0
        assert "_id" not in item
        h = s.get(f"{API}/sessions", params={"scene": "hallway"}).json()
        assert any(x["id"] == sid for x in h)
        assert all(x["scene"] == "hallway" for x in h)
        c = s.get(f"{API}/sessions", params={"scene": "city"}).json()
        assert not any(x["id"] == sid for x in c)

    def test_unknown_404(self, s):
        assert s.get(f"{API}/sessions/nope-123/jsonl").status_code == 404
        assert s.post(f"{API}/sessions/nope-123/chunks", json={"idx": 0, "data": "x"}).status_code == 404
        assert s.delete(f"{API}/sessions/nope-123").status_code == 404

    def test_delete(self, s):
        sid = TestSessions.sid
        r = s.delete(f"{API}/sessions/{sid}")
        assert r.status_code == 200
        assert s.get(f"{API}/sessions/{sid}/jsonl").status_code == 404
        assert not any(x["id"] == sid for x in s.get(f"{API}/sessions").json())
        assert s.delete(f"{API}/sessions/{sid}").status_code == 404
