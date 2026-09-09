"""
VoicePilot AI — FastAPI Application & Routes

Provides HTTP REST endpoints and WebSocket realtime endpoint.
"""
from __future__ import annotations

import uuid
from typing import Optional

import structlog
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.security.config import get_settings
from app.realtime.session import VoiceSession
from app.voice_catalog.catalog_service import get_catalog_service
from app.tts.rime_adapter import get_rime_adapter
from app.tts.speech_writer import PRONUNCIATION_FIXTURES
from app.tools.registry import get_tool_registry

logger = structlog.get_logger(__name__)

settings = get_settings()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="VoicePilot AI",
        description="Real-time interruptible voice agent powered by Rime TTS",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Active sessions tracking
    active_sessions: dict[str, VoiceSession] = {}

    # ── WebSocket realtime endpoint ───────────────────────────────────────────
    @app.websocket("/ws/voice/{session_id}")
    async def voice_websocket(websocket: WebSocket, session_id: str):
        if len(active_sessions) >= settings.max_websocket_connections:
            await websocket.close(code=1013, reason="Max connections reached")
            return

        await websocket.accept()
        session = VoiceSession(websocket, session_id)
        active_sessions[session_id] = session
        logger.info("ws_connected", session_id=session_id, total=len(active_sessions))

        try:
            await session.run()
        finally:
            active_sessions.pop(session_id, None)
            logger.info("ws_disconnected", session_id=session_id, total=len(active_sessions))

    @app.websocket("/ws/voice")
    async def voice_websocket_autoid(websocket: WebSocket):
        session_id = str(uuid.uuid4())
        await voice_websocket(websocket, session_id)

    # ── REST API endpoints ────────────────────────────────────────────────────
    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "service": "VoicePilot AI",
            "rime_configured": settings.rime_configured,
            "rime": {
                "configured": settings.rime_configured,
                "model_id": settings.rime_model_id,
                "voice": settings.rime_voice,
            },
            "active_sessions": len(active_sessions),
        }

    @app.get("/config")
    async def get_config():
        """Return observable config without secrets."""
        return settings.redacted_summary()

    @app.get("/catalog/models")
    async def get_models():
        catalog = get_catalog_service()
        models = await catalog.get_available_models()
        return {"models": models, "count": len(models)}

    @app.get("/catalog/languages")
    async def get_languages():
        catalog = get_catalog_service()
        languages = await catalog.get_available_languages()
        return {"languages": languages, "count": len(languages)}

    @app.get("/catalog/voices")
    @app.get("/api/voices")
    async def get_voices(model_id: Optional[str] = None, language: Optional[str] = None):
        catalog = get_catalog_service()
        if model_id and language:
            voices = [
                v for v in await catalog.get_voices_for_model(model_id)
                if v["language"] == language
            ]
        elif model_id:
            voices = await catalog.get_voices_for_model(model_id)
        elif language:
            voices = await catalog.get_voices_for_language(language)
        else:
            # Return first 50 voices
            meta = await catalog.get_voice_metadata()
            voices = list(meta.keys())[:50] if hasattr(meta, 'keys') else [v.voice_id for v in await catalog.get_voices()][:50]
        return {"voices": voices, "count": len(voices)}

    @app.get("/catalog/voice/{voice_id}")
    async def get_voice_detail(voice_id: str):
        catalog = get_catalog_service()
        details = await catalog.get_voice_details(voice_id)
        if not details:
            raise HTTPException(status_code=404, detail=f"Voice '{voice_id}' not found")
        return details

    @app.get("/catalog/status")
    async def catalog_status():
        catalog = get_catalog_service()
        return catalog.get_cache_status()

    @app.get("/tools")
    async def list_tools():
        registry = get_tool_registry()
        return {"tools": registry.list_tools()}

    @app.get("/pronunciation/fixtures")
    async def get_pronunciation_fixtures():
        return {"fixtures": PRONUNCIATION_FIXTURES}

    @app.get("/tts/status")
    async def tts_status():
        rime = get_rime_adapter()
        return {
            "provider": "rime",
            "is_mock": rime.is_mock,
            "config": rime.config.to_dict(),
        }

    @app.get("/sessions")
    async def list_sessions():
        return {
            "active_count": len(active_sessions),
            "session_ids": list(active_sessions.keys()),
        }

    @app.post("/api/acceptance/run")
    @app.get("/api/acceptance/run")
    async def api_run_acceptance():
        class MockWS:
            async def send_text(self, data):
                pass
        from app.realtime.session import VoiceSession
        from app.evaluation.acceptance import run_acceptance_test
        session = VoiceSession(MockWS(), f"acc-{uuid.uuid4()}")
        return await run_acceptance_test(session)

    return app
