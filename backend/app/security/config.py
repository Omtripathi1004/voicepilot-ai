"""
VoicePilot AI — Security & Configuration Module

Loads configuration from environment variables with validation.
Never exposes secret values in logs or error messages.
"""
from __future__ import annotations

import os
import sys
from functools import lru_cache
from typing import List, Optional

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Rime TTS ──────────────────────────────────────────────────────────────
    rime_api_key: Optional[str] = None
    rime_model_id: str = "mist"
    rime_voice: str = "luna"
    rime_language: str = "eng"
    rime_endpoint: str = "https://users.rime.ai/v1/rime-tts"
    rime_audio_format: str = "mp3"
    rime_region: Optional[str] = None

    # ── Public Rime Catalog (keyless) ─────────────────────────────────────────
    rime_voice_catalog_url: str = "https://users.rime.ai/data/voices/all-v2.json"
    rime_voice_details_url: str = "https://users.rime.ai/data/voices/voice_details.json"

    # ── Backend ───────────────────────────────────────────────────────────────
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:4173"
    log_level: str = "INFO"
    secret_key: str = "dev-secret-change-in-production"

    # ── STT ───────────────────────────────────────────────────────────────────
    stt_provider: str = "browser"  # 'browser' | 'whisper'
    whisper_model_size: Optional[str] = None

    # ── LLM ───────────────────────────────────────────────────────────────────
    llm_provider: str = "local"  # 'local' | 'openai' | 'anthropic'
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    rate_limit_per_minute: int = 60
    max_websocket_connections: int = 20

    # ── Audio ─────────────────────────────────────────────────────────────────
    audio_sample_rate: int = 16000
    audio_chunk_size: int = 1024
    tts_cache_enabled: bool = True
    tts_cache_ttl_seconds: int = 3600

    # ── Voice Catalog Cache ────────────────────────────────────────────────────
    voice_catalog_cache_ttl_seconds: int = 3600

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def rime_configured(self) -> bool:
        """Returns True if Rime API key is available."""
        return bool(self.rime_api_key and self.rime_api_key.strip())

    def validate_on_startup(self) -> list[str]:
        """
        Validate configuration at startup.
        Returns list of warning/error messages without printing secret values.
        """
        issues = []

        if not self.rime_configured:
            issues.append(
                "WARNING: RIME_API_KEY is not set. Rime TTS will use mock mode. "
                "Set RIME_API_KEY to enable real Rime synthesis."
            )

        if self.secret_key == "dev-secret-change-in-production":
            issues.append(
                "WARNING: SECRET_KEY is using the default development value. "
                "Set a long random SECRET_KEY for production."
            )

        if self.llm_provider == "openai" and not self.openai_api_key:
            issues.append(
                "ERROR: LLM_PROVIDER=openai but OPENAI_API_KEY is not set. "
                "Set OPENAI_API_KEY or switch LLM_PROVIDER=local."
            )

        if self.llm_provider == "anthropic" and not self.anthropic_api_key:
            issues.append(
                "ERROR: LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set. "
                "Set ANTHROPIC_API_KEY or switch LLM_PROVIDER=local."
            )

        return issues

    def redacted_summary(self) -> dict:
        """Returns a safe configuration summary with secrets redacted."""
        return {
            "rime_model_id": self.rime_model_id,
            "rime_voice": self.rime_voice,
            "rime_language": self.rime_language,
            "rime_endpoint": self.rime_endpoint,
            "rime_audio_format": self.rime_audio_format,
            "rime_region": self.rime_region,
            "rime_configured": self.rime_configured,
            "rime_api_key": "***" if self.rime_configured else "(not set)",
            "stt_provider": self.stt_provider,
            "llm_provider": self.llm_provider,
            "backend_port": self.backend_port,
            "cors_origins": self.cors_origins_list,
            "tts_cache_enabled": self.tts_cache_enabled,
            "voice_catalog_cache_ttl_seconds": self.voice_catalog_cache_ttl_seconds,
        }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
