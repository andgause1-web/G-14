from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from pathlib import Path
import asyncio
import io
import json
import logging
import os
import zipfile

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

KIT_DIR = ROOT_DIR / "unreal_kit"
LANGS = {".h": "cpp", ".cpp": "cpp", ".cs": "csharp", ".json": "json", ".md": "markdown"}

app = FastAPI()
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


class TelemetryHub:
    def __init__(self):
        self.subscribers: set = set()
        self.publishers: int = 0
        self.latest: Optional[Dict[str, Any]] = None
        self.last_at: Optional[str] = None
        self.frames: int = 0

    async def publish(self, frame: Dict[str, Any]):
        self.latest = frame
        self.last_at = datetime.now(timezone.utc).isoformat()
        self.frames += 1
        text = json.dumps(frame)
        dead = []
        for ws in list(self.subscribers):
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.subscribers.discard(ws)


hub = TelemetryHub()


class StreamStatus(BaseModel):
    subscribers: int
    publishers: int
    frames: int
    last_at: Optional[str]
    last_seq: Optional[int]


class KitFile(BaseModel):
    path: str
    name: str
    language: str
    size: int
    content: str


def valid_frame(data: Any) -> bool:
    return isinstance(data, dict) and str(data.get("schema", "")).startswith("g14.hud.")


@api_router.get("/")
async def root():
    return {"message": "G-14 Aether Wave HUD relay"}


@api_router.websocket("/ws/hud")
async def ws_hud(websocket: WebSocket, role: str = Query("subscriber")):
    await websocket.accept()
    is_pub = role == "publisher"
    if is_pub:
        hub.publishers += 1
    else:
        hub.subscribers.add(websocket)
        if hub.latest:
            await websocket.send_text(json.dumps(hub.latest))
    try:
        while True:
            text = await websocket.receive_text()
            if not is_pub:
                continue
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                continue
            if valid_frame(data):
                await hub.publish(data)
    except WebSocketDisconnect:
        pass
    finally:
        if is_pub:
            hub.publishers = max(0, hub.publishers - 1)
        else:
            hub.subscribers.discard(websocket)


@api_router.post("/telemetry")
async def post_telemetry(frame: Dict[str, Any]):
    if not valid_frame(frame):
        raise HTTPException(status_code=400, detail="Frame must include schema 'g14.hud.v1'")
    await hub.publish(frame)
    return {"ok": True, "subscribers": len(hub.subscribers)}


@api_router.get("/telemetry/latest")
async def latest_telemetry():
    if not hub.latest:
        raise HTTPException(status_code=404, detail="No frame published yet")
    return hub.latest


@api_router.get("/stream/status", response_model=StreamStatus)
async def stream_status():
    return StreamStatus(
        subscribers=len(hub.subscribers),
        publishers=hub.publishers,
        frames=hub.frames,
        last_at=hub.last_at,
        last_seq=(hub.latest or {}).get("seq"),
    )


def read_kit() -> List[KitFile]:
    files = []
    for p in sorted(KIT_DIR.rglob("*")):
        if p.is_file():
            content = p.read_text(encoding="utf-8")
            rel = p.relative_to(KIT_DIR).as_posix()
            files.append(KitFile(path=rel, name=p.name, language=LANGS.get(p.suffix, "text"),
                                 size=len(content.encode("utf-8")), content=content))
    return files


@api_router.get("/unreal/files", response_model=List[KitFile])
async def unreal_files():
    return await asyncio.to_thread(read_kit)


@api_router.get("/unreal/kit.zip")
async def unreal_zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in read_kit():
            zf.writestr(f"G14Hud/{f.path}", f.content)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip",
                             headers={"Content-Disposition": "attachment; filename=G14Hud_UnrealKit.zip"})


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
