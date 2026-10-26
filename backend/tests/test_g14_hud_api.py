# G-14 Aether Wave HUD relay backend tests: telemetry, stream status, websocket relay, unreal kit
import asyncio
import io
import json
import os
import time
import zipfile

import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws/hud"


def frame(seq=1):
    return {"schema": "g14.hud.v1", "seq": seq, "t_ms": int(time.time() * 1000), "source": "TEST_",
            "eeg": {"sensor": "ADS1299"}, "imu": {"sensor": "BMI270"}, "scan": {"sensor": "TSL1401CL", "entities": []}}


# Root
def test_root():
    r = requests.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert "G-14" in r.json()["message"]


# Telemetry POST + latest
class TestTelemetry:
    def test_post_valid_and_latest(self):
        f = frame(987654)
        r = requests.post(f"{BASE_URL}/api/telemetry", json=f)
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert isinstance(r.json()["subscribers"], int)
        latest = requests.get(f"{BASE_URL}/api/telemetry/latest")
        assert latest.status_code == 200
        assert latest.json()["seq"] == 987654
        assert latest.json()["schema"] == "g14.hud.v1"

    def test_post_invalid_schema(self):
        r = requests.post(f"{BASE_URL}/api/telemetry", json={"schema": "foo", "seq": 1})
        assert r.status_code == 400
        assert "g14.hud.v1" in r.json()["detail"]

    def test_post_missing_schema(self):
        r = requests.post(f"{BASE_URL}/api/telemetry", json={"seq": 1})
        assert r.status_code == 400

    def test_post_non_object(self):
        r = requests.post(f"{BASE_URL}/api/telemetry", json=[1, 2])
        assert r.status_code in (400, 422)

    def test_stream_status(self):
        r = requests.get(f"{BASE_URL}/api/stream/status")
        assert r.status_code == 200
        d = r.json()
        for k in ("subscribers", "publishers", "frames", "last_at", "last_seq"):
            assert k in d
        assert d["frames"] >= 1


# WebSocket relay publisher -> subscriber
class TestWebSocket:
    def test_pub_sub_relay(self):
        async def run():
            async with websockets.connect(WS_URL) as sub:
                # drain initial latest frame if any
                try:
                    await asyncio.wait_for(sub.recv(), timeout=3)
                except asyncio.TimeoutError:
                    pass
                st = requests.get(f"{BASE_URL}/api/stream/status").json()
                assert st["subscribers"] >= 1
                async with websockets.connect(WS_URL + "?role=publisher") as pub:
                    await asyncio.sleep(0.5)
                    st2 = requests.get(f"{BASE_URL}/api/stream/status").json()
                    assert st2["publishers"] >= 1
                    await pub.send("not json")
                    await pub.send(json.dumps({"schema": "bad"}))
                    await pub.send(json.dumps(frame(555111)))
                    got = None
                    for _ in range(10):
                        msg = json.loads(await asyncio.wait_for(sub.recv(), timeout=5))
                        if msg.get("seq") == 555111:
                            got = msg
                            break
                    assert got is not None
                    assert got["schema"] == "g14.hud.v1"
                    # subscriber messages ignored
                    await sub.send(json.dumps(frame(222)))
                    await asyncio.sleep(0.5)
                    assert requests.get(f"{BASE_URL}/api/telemetry/latest").json()["seq"] != 222
        asyncio.run(run())


# Unreal kit
class TestUnrealKit:
    def test_files(self):
        r = requests.get(f"{BASE_URL}/api/unreal/files")
        assert r.status_code == 200
        files = r.json()
        assert len(files) == 9
        for f in files:
            assert f["content"] and f["size"] > 0
            assert f["path"] and f["name"] and f["language"]
        names = [f["name"] for f in files]
        assert "G14TelemetryReceiver.cpp" in names

    def test_zip(self):
        r = requests.get(f"{BASE_URL}/api/unreal/kit.zip")
        assert r.status_code == 200
        assert "zip" in r.headers["content-type"]
        assert "G14Hud_UnrealKit.zip" in r.headers.get("content-disposition", "")
        z = zipfile.ZipFile(io.BytesIO(r.content))
        assert len(z.namelist()) == 9
        assert all(n.startswith("G14Hud/") for n in z.namelist())
