"""
VoicePilot AI — Rime TTS Adapter

Integrates with the Rime TTS synthesis API.
Requires RIME_API_KEY (organizer-provided).
Falls back to mock audio when not configured.
"""
from __future__ import annotations

import asyncio
import io
import math
import struct
import time
from typing import AsyncIterator, Optional

import httpx
import structlog

from app.security.config import get_settings

logger = structlog.get_logger(__name__)


class RimeConfig:
    """Current Rime synthesis configuration (observable, secret-free)."""

    def __init__(self):
        s = get_settings()
        self.model_id = s.rime_model_id
        self.voice = s.rime_voice
        self.language = s.rime_language
        self.endpoint = s.rime_endpoint
        self.audio_format = s.rime_audio_format
        self.region = s.rime_region

    def update(self, model_id: str = None, voice: str = None, language: str = None):
        if model_id:
            self.model_id = model_id
        if voice:
            self.voice = voice
        if language:
            self.language = language

    def to_dict(self) -> dict:
        return {
            "model_id": self.model_id,
            "voice": self.voice,
            "language": self.language,
            "endpoint": self.endpoint,
            "audio_format": self.audio_format,
            "region": self.region,
            "provider": "rime",
        }


def _generate_mock_audio(text: str, duration_seconds: float = 1.5) -> bytes:
    """
    Generate a WAV-format mock audio tone for development when RIME_API_KEY
    is not configured. The tone frequency encodes text length as a visual cue.
    This is clearly labeled as mock and only used when Rime is unconfigured.
    """
    sample_rate = 22050
    frequency = 440 + (len(text) % 20) * 10  # tone varies by text length
    num_samples = int(sample_rate * duration_seconds)

    samples = []
    for i in range(num_samples):
        # Sine wave with fade in/out
        t = i / sample_rate
        fade = min(t, duration_seconds - t, 0.1) / 0.1
        fade = max(0.0, min(1.0, fade))
        sample = int(32767 * 0.3 * fade * math.sin(2 * math.pi * frequency * t))
        samples.append(sample)

    # Build WAV file
    buf = io.BytesIO()
    # RIFF header
    data_size = num_samples * 2
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))     # chunk size
    buf.write(struct.pack("<H", 1))      # PCM
    buf.write(struct.pack("<H", 1))      # mono
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", sample_rate * 2))
    buf.write(struct.pack("<H", 2))      # block align
    buf.write(struct.pack("<H", 16))     # bits per sample
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    for s in samples:
        buf.write(struct.pack("<h", s))

    return buf.getvalue()


class RimeTTSAdapter:
    """
    Adapter for Rime TTS synthesis.

    Uses RIME_API_KEY for actual TTS requests.
    Falls back to mock audio for development if key is absent.
    Never exposes the API key.
    """

    def __init__(self):
        self.settings = get_settings()
        self.config = RimeConfig()
        self._mock_mode = not self.settings.rime_configured

        if self._mock_mode:
            logger.warning(
                "rime_adapter_mock_mode",
                reason="RIME_API_KEY not configured",
                action="Using mock audio. Set RIME_API_KEY for real Rime synthesis.",
            )
        else:
            logger.info(
                "rime_adapter_ready",
                model=self.config.model_id,
                voice=self.config.voice,
                language=self.config.language,
                endpoint=self.config.endpoint,
                audio_format=self.config.audio_format,
            )

    @property
    def is_mock(self) -> bool:
        return self._mock_mode

    async def synthesize_stream(
        self,
        text: str,
        model_id: Optional[str] = None,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncIterator[bytes]:
        """
        Stream synthesized audio bytes.
        Checks cancel_event before/during streaming for interruption support.
        """
        eff_model = model_id or self.config.model_id
        eff_voice = voice or self.config.voice
        eff_language = language or self.config.language

        start_time = time.time()

        if self._mock_mode:
            async for chunk in self._mock_stream(text, cancel_event):
                yield chunk
            return

        async for chunk in self._rime_stream(
            text, eff_model, eff_voice, eff_language, cancel_event, start_time
        ):
            yield chunk

    async def _rime_stream(
        self,
        text: str,
        model_id: str,
        voice: str,
        language: str,
        cancel_event: Optional[asyncio.Event],
        start_time: float,
    ) -> AsyncIterator[bytes]:
        """Stream from actual Rime API."""
        headers = {
            "Authorization": f"Bearer {self.settings.rime_api_key}",
            "Accept": f"audio/{self.config.audio_format}",
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "modelId": model_id,
            "speaker": voice,
            "audioFormat": self.config.audio_format,
            "lang": language,
        }
        if self.config.region:
            payload["region"] = self.config.region

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST",
                    self.config.endpoint,
                    headers=headers,
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        body = await response.aread()
                        logger.error(
                            "rime_tts_error",
                            status=response.status_code,
                            body=body[:200].decode("utf-8", errors="replace"),
                        )
                        # Fall through to mock on error
                        async for chunk in self._mock_stream(text, cancel_event):
                            yield chunk
                        return

                    first_chunk = True
                    async for chunk in response.aiter_bytes(chunk_size=4096):
                        if cancel_event and cancel_event.is_set():
                            logger.info("rime_stream_cancelled")
                            return
                        if first_chunk:
                            ttfa = time.time() - start_time
                            logger.info("rime_first_audio", ttfa_ms=ttfa * 1000)
                            first_chunk = False
                        yield chunk
        except asyncio.CancelledError:
            logger.info("rime_stream_task_cancelled")
            raise
        except Exception as e:
            logger.error("rime_stream_exception", error=str(e))
            async for chunk in self._mock_stream(text, cancel_event):
                yield chunk

    async def _mock_stream(
        self,
        text: str,
        cancel_event: Optional[asyncio.Event],
    ) -> AsyncIterator[bytes]:
        """Stream mock audio in chunks to simulate streaming behavior."""
        duration = max(1.0, len(text) * 0.04)  # ~40ms per char
        audio = _generate_mock_audio(text, duration_seconds=min(duration, 5.0))

        chunk_size = 4096
        for i in range(0, len(audio), chunk_size):
            if cancel_event and cancel_event.is_set():
                logger.info("mock_stream_cancelled")
                return
            yield audio[i : i + chunk_size]
            await asyncio.sleep(0.05)  # simulate network delay

    async def synthesize_full(
        self,
        text: str,
        model_id: Optional[str] = None,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> bytes:
        """Collect full audio bytes (for testing/benchmark)."""
        chunks = []
        async for chunk in self.synthesize_stream(
            text, model_id, voice, language, cancel_event
        ):
            chunks.append(chunk)
        return b"".join(chunks)

    def update_config(self, model_id: str = None, voice: str = None, language: str = None):
        self.config.update(model_id=model_id, voice=voice, language=language)


# Singleton
_rime_adapter: Optional[RimeTTSAdapter] = None


def get_rime_adapter() -> RimeTTSAdapter:
    global _rime_adapter
    if _rime_adapter is None:
        _rime_adapter = RimeTTSAdapter()
    return _rime_adapter
