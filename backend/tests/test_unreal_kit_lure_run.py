# Unreal kit: run/lure/stance/head-height/breath additions (iteration 8)
import io
import json
import os
import zipfile

import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def _files():
    r = requests.get(f"{BASE_URL}/api/unreal/files", timeout=20)
    assert r.status_code == 200
    return {f["path"]: f for f in r.json()}


def test_types_header_has_new_structs():
    f = _files()["Source/G14Hud/Public/G14HudTypes.h"]["content"]
    for tok in ["FG14RunData", "FG14LureData", "EG14Stance", "HeadHeightM", "BreathHz", "StepCount", "OffsetYawDeg"]:
        assert tok in f, tok


def test_receiver_parses_run_and_lure():
    f = _files()["Source/G14Hud/Private/G14TelemetryReceiver.cpp"]["content"]
    for tok in ['TEXT("run")', 'TEXT("lure")', 'TEXT("head_height_m")', 'TEXT("breath_hz")', 'TEXT("dx_deg")', 'TEXT("step")']:
        assert tok in f, tok


def test_sample_json_has_run_lure():
    d = json.loads(_files()["Schema/g14_hud_v1.sample.json"]["content"])
    assert d["run"]["stance"] in ("stand", "crouch", "prone")
    assert isinstance(d["run"]["step"], int)
    for k in ["target_id", "pull", "resist", "resisting", "dx_deg", "dy_deg"]:
        assert k in d["hud"]["lure"]
    assert "breath_hz" in d["bio"] and "breath_phase" in d["bio"]
    assert "head_height_m" in d["imu"]


def test_readme_sections():
    f = _files()["README.md"]["content"]
    assert "Live Vector Run" in f
    assert "Luciferic lure" in f


def test_zip_contains_updated_header():
    r = requests.get(f"{BASE_URL}/api/unreal/kit.zip", timeout=20)
    assert r.status_code == 200
    z = zipfile.ZipFile(io.BytesIO(r.content))
    h = z.read("G14Hud/Source/G14Hud/Public/G14HudTypes.h").decode()
    assert "FG14LureData" in h and "FG14RunData" in h


def test_telemetry_accepts_lure_run_frame():
    d = json.loads(_files()["Schema/g14_hud_v1.sample.json"]["content"])
    r = requests.post(f"{BASE_URL}/api/telemetry", json=d, timeout=20)
    assert r.status_code == 200
    latest = requests.get(f"{BASE_URL}/api/telemetry/latest", timeout=20).json()
    frame = latest.get("frame", latest)
    assert frame["hud"]["lure"]["target_id"] == d["hud"]["lure"]["target_id"]
