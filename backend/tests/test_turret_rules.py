# G-13 Wolf-Trap turret rules block: GET structure + PUT validation (restores rules)
import os
import copy
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def original():
    r = requests.get(f"{BASE_URL}/api/rules", timeout=20)
    assert r.status_code == 200
    rules = r.json()["rules"]
    yield rules
    requests.put(f"{BASE_URL}/api/rules", json={"rules": rules}, timeout=20)


class TestTurretRules:
    def test_turret_block(self, original):
        T = original["turret"]
        assert T["deploy_s"] == 3
        assert "acoustic" in T and T["acoustic"]["range_m"] > 0
        assert T["laser"]["max_target_mps"] == 10
        assert T["resonance"]["golem"]["hz"] == 528
        assert T["resonance"]["pygmy"]["hz"] == 1400
        assert T["resonance"]["wraith"]["hz"] == 180
        assert "decoy_mult" in T["resonance"]["wraith"]
        assert set(["none", "g12_wide", "g12_long", "g12_decoy"]) <= set(T["modules"])
        assert T["modules"]["g12_decoy"]["decoy"] is True
        assert T["possession"]["shutdown_hold_s"] == 2.5

    def test_put_without_turret_400(self, original):
        bad = copy.deepcopy(original)
        bad.pop("turret")
        r = requests.put(f"{BASE_URL}/api/rules", json={"rules": bad}, timeout=20)
        assert r.status_code == 400
        assert "turret" in r.json()["detail"]
        # file untouched
        g = requests.get(f"{BASE_URL}/api/rules", timeout=20).json()["rules"]
        assert "turret" in g

    def test_put_roundtrip_hot_reload(self, original):
        mod = copy.deepcopy(original)
        mod["turret"]["deploy_s"] = 0.5
        r = requests.put(f"{BASE_URL}/api/rules", json={"rules": mod}, timeout=20)
        assert r.status_code == 200
        assert r.json()["rules"]["turret"]["deploy_s"] == 0.5
        g = requests.get(f"{BASE_URL}/api/rules", timeout=20).json()["rules"]
        assert g["turret"]["deploy_s"] == 0.5
        r2 = requests.put(f"{BASE_URL}/api/rules", json={"rules": original}, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["rules"]["turret"]["deploy_s"] == 3


# Turret AUTO mode + Tone Lock Assist rules blocks
class TestTurretAutoToneLock:
    def test_auto_block(self, original):
        A = original["turret"]["auto"]
        assert A == {"switch_m": 10, "min_conf": 55, "sweep_hz_per_s": 700, "min_heat_factor": 0.35}

    def test_tone_lock_block(self, original):
        TL = original["turret"]["tone_lock"]
        assert TL["show_from"] == 0.15
        assert TL["lock_at"] == 0.85
        assert TL["show_from"] < TL["lock_at"]

    def test_put_roundtrip_auto(self, original):
        mod = copy.deepcopy(original)
        mod["turret"]["auto"]["switch_m"] = 12
        mod["turret"]["tone_lock"]["lock_at"] = 0.9
        r = requests.put(f"{BASE_URL}/api/rules", json={"rules": mod}, timeout=20)
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/rules", timeout=20).json()["rules"]
        assert g["turret"]["auto"]["switch_m"] == 12
        assert g["turret"]["tone_lock"]["lock_at"] == 0.9
        r2 = requests.put(f"{BASE_URL}/api/rules", json={"rules": original}, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["rules"]["turret"]["auto"]["switch_m"] == 10
        assert r2.json()["rules"]["turret"]["tone_lock"]["lock_at"] == 0.85

    # iteration 12: target hysteresis margin
    def test_retarget_margin(self, original):
        m = original["turret"]["retarget_margin"]
        assert isinstance(m, (int, float)) and m == 0.35

    def test_put_roundtrip_retarget_margin(self, original):
        mod = copy.deepcopy(original)
        mod["turret"]["retarget_margin"] = 0.5
        r = requests.put(f"{BASE_URL}/api/rules", json={"rules": mod}, timeout=20)
        assert r.status_code == 200
        assert requests.get(f"{BASE_URL}/api/rules", timeout=20).json()["rules"]["turret"]["retarget_margin"] == 0.5
        r2 = requests.put(f"{BASE_URL}/api/rules", json={"rules": original}, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["rules"]["turret"]["retarget_margin"] == 0.35
