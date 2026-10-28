# Possession rules block (stages, rigidity, breach, takeover, egregore, profiles) API tests
import copy
import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def orig(s):
    r = s.get(f"{API}/rules")
    assert r.status_code == 200
    data = r.json()["rules"]
    yield data
    assert s.put(f"{API}/rules", json={"rules": data}).status_code == 200


def test_possession_block_present(orig):
    P = orig["possession"]
    for k in ["stasis", "stages", "rigidity", "breach", "takeover", "egregore", "profiles", "cooldown_s"]:
        assert k in P


def test_stage_thresholds(orig):
    st = sorted(orig["possession"]["stages"], key=lambda x: x["stage"])
    assert [x["stage"] for x in st] == [0, 1, 2, 3, 4, 5]
    assert [x["min_stasis"] for x in st] == [76, 56, 36, 16, 1, 0]
    assert [x["tension"] for x in st[:5]] == [0, 20, 45, 70, 100]
    assert st[1]["jitter_deg"] == [0.5, 1]
    assert st[3]["lag_ms"] == [80, 150] and st[3]["invert"] is True and st[3]["ghost_limb"] is True
    assert st[4]["input"] == "resist_only"
    assert st[5]["input"] == "entity"


def test_rigidity_breach_takeover(orig):
    P = orig["possession"]
    R = P["rigidity"]
    assert R["pivot_stasis"] == 60 and R["reduce_factor"] == 0.6 and R["stiffness_cost"] == 0.5 and R["cap_s"] == 3
    assert P["breach"]["seconds"] == 8 and P["breach"]["success_stasis"] == 40
    assert P["takeover"]["release_stasis"] == 25 and P["takeover"]["seconds"] > 0


def test_egregore_and_profiles(orig):
    P = orig["possession"]
    assert P["egregore"]["types"] == ["sentinel", "golem"]
    prof = P["profiles"]
    for t in ["default", "pygmy", "gnome", "golem", "sentinel"]:
        assert t in prof
    assert prof["golem"]["lag"] > prof["pygmy"]["lag"]
    assert prof["pygmy"]["jitter"] > prof["golem"]["jitter"]
    assert prof["golem"]["lag_from_stage"] == 2


def test_put_without_possession_400(s, orig):
    bad = copy.deepcopy(orig)
    bad.pop("possession")
    r = s.put(f"{API}/rules", json={"rules": bad})
    assert r.status_code == 400
    assert "possession" in r.json()["detail"]


def test_put_roundtrip_possession_edit(s, orig):
    mod = copy.deepcopy(orig)
    mod["possession"]["rigidity"]["pivot_stasis"] = 61
    r = s.put(f"{API}/rules", json={"rules": mod})
    assert r.status_code == 200
    assert s.get(f"{API}/rules").json()["rules"]["possession"]["rigidity"]["pivot_stasis"] == 61
    assert s.put(f"{API}/rules", json={"rules": orig}).status_code == 200
    assert s.get(f"{API}/rules").json()["rules"]["possession"]["rigidity"]["pivot_stasis"] == 60
