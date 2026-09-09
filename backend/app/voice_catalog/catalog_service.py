"""
VoicePilot AI — Voice Catalog Service

Fetches, validates, caches, and exposes the public Rime voice catalog.
NO API KEY required for catalog endpoints.
Separate from the actual TTS synthesis endpoint which uses RIME_API_KEY.
"""
from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, List, Optional

import httpx
import structlog

logger = structlog.get_logger(__name__)

# Public Rime catalog endpoints — no API key required
CATALOG_URL = "https://users.rime.ai/data/voices/all-v2.json"
DETAILS_URL = "https://users.rime.ai/data/voices/voice_details.json"


class VoiceEntry:
    def __init__(self, voice_id: str, model_id: str, language: str, metadata: dict):
        self.voice_id = voice_id
        self.model_id = model_id
        self.language = language
        self.gender: Optional[str] = metadata.get("gender")
        self.age: Optional[str] = metadata.get("age")
        self.dialect: Optional[str] = metadata.get("dialect")
        self.flagship: bool = metadata.get("flagship", False)
        self.display_name: str = metadata.get("display_name", voice_id)
        self.raw: dict = metadata

    def to_dict(self) -> Dict[str, Any]:
        return {
            "voice_id": self.voice_id,
            "model_id": self.model_id,
            "language": self.language,
            "gender": self.gender,
            "age": self.age,
            "dialect": self.dialect,
            "flagship": self.flagship,
            "display_name": self.display_name,
        }


class VoiceCatalogService:
    """
    Service to manage the Rime public voice catalog.

    Endpoints used (keyless):
      https://users.rime.ai/data/voices/all-v2.json
      https://users.rime.ai/data/voices/voice_details.json

    The actual TTS synthesis endpoint is separate and uses RIME_API_KEY.
    """

    def __init__(self, cache_ttl_seconds: int = 3600):
        self._cache_ttl = cache_ttl_seconds
        self._catalog_cache: Optional[Dict] = None  # all-v2.json data
        self._details_cache: Optional[Dict] = None  # voice_details.json data
        self._last_fetch: float = 0.0
        self._lock = asyncio.Lock()
        self._voices: Dict[str, VoiceEntry] = {}  # voice_id -> VoiceEntry

    async def _fetch_json(self, url: str) -> Optional[Dict]:
        """Fetch JSON from a URL with error handling."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.warning("voice_catalog_fetch_failed", url=url, error=str(e))
            return None

    async def _refresh(self, force: bool = False):
        """Refresh cache if stale or forced. Falls back to last valid cache."""
        async with self._lock:
            now = time.time()
            if not force and self._catalog_cache and (now - self._last_fetch) < self._cache_ttl:
                return  # still fresh

            catalog = await self._fetch_json(CATALOG_URL)
            details = await self._fetch_json(DETAILS_URL)

            if catalog is not None:
                self._catalog_cache = catalog
            if details is not None:
                self._details_cache = details

            if catalog is not None or details is not None:
                self._last_fetch = now
                self._build_voice_index()
                logger.info(
                    "voice_catalog_refreshed",
                    voice_count=len(self._voices),
                    cached_at=now,
                )
            else:
                logger.warning(
                    "voice_catalog_refresh_failed_using_cache",
                    has_catalog=self._catalog_cache is not None,
                )

    def _build_voice_index(self):
        """Build a fast lookup index from catalog + details data."""
        self._voices = {}
        if not self._catalog_cache:
            return

        if isinstance(self._details_cache, dict):
            details_map = self._details_cache
        elif isinstance(self._details_cache, list):
            details_map = {}
            for item in self._details_cache:
                if isinstance(item, dict):
                    v_key = item.get("name") or item.get("id") or item.get("voice_id") or item.get("speaker")
                    if v_key:
                        details_map[str(v_key)] = item
        else:
            details_map = {}

        # all-v2.json structure: { modelId: { languageCode: [voiceId, ...] } }
        for model_id, lang_map in self._catalog_cache.items():
            if not isinstance(lang_map, dict):
                continue
            for language, voices in lang_map.items():
                if not isinstance(voices, list):
                    continue
                for voice_id in voices:
                    if not isinstance(voice_id, str):
                        continue
                    meta = details_map.get(voice_id, {})
                    entry = VoiceEntry(
                        voice_id=voice_id,
                        model_id=model_id,
                        language=language,
                        metadata=meta,
                    )
                    self._voices[voice_id] = entry

    async def ensure_loaded(self):
        """Ensure catalog is loaded (at least once)."""
        if not self._catalog_cache:
            await self._refresh(force=True)

    async def get_voice_catalog(self) -> Dict:
        await self._refresh()
        return self._catalog_cache or {}

    async def get_voice_metadata(self) -> Dict:
        await self._refresh()
        if isinstance(self._details_cache, dict):
            return self._details_cache
        elif isinstance(self._details_cache, list):
            res = {}
            for item in self._details_cache:
                if isinstance(item, dict):
                    k = item.get("name") or item.get("id") or item.get("voice_id") or item.get("speaker")
                    if k:
                        res[str(k)] = item
            return res
        return {vid: v.metadata for vid, v in self._voices.items()}

    async def get_available_models(self) -> List[str]:
        await self._refresh()
        if not self._catalog_cache:
            return []
        return sorted(self._catalog_cache.keys())

    async def get_available_languages(self) -> List[str]:
        await self._refresh()
        langs = set()
        for entry in self._voices.values():
            langs.add(entry.language)
        return sorted(langs)

    async def get_voices_for_model(self, model_id: str) -> List[Dict]:
        await self._refresh()
        return [
            v.to_dict()
            for v in self._voices.values()
            if v.model_id == model_id
        ]

    async def get_voices_for_language(self, language: str) -> List[Dict]:
        await self._refresh()
        return [
            v.to_dict()
            for v in self._voices.values()
            if v.language == language
        ]

    async def get_voices(self) -> List[Dict]:
        await self._refresh()
        return [v.to_dict() for v in self._voices.values()]

    async def get_voice_details(self, voice_id: str) -> Optional[Dict]:
        await self._refresh()
        v = self._voices.get(voice_id)
        if v:
            return v.to_dict()
        return None

    async def is_valid_combination(
        self, model_id: str, language: str, voice_id: str
    ) -> bool:
        """Return True only if model+language+voice is a valid catalog combination."""
        await self._refresh()
        v = self._voices.get(voice_id)
        if not v:
            return False
        return v.model_id == model_id and v.language == language

    async def find_compatible_voice(
        self, model_id: str, language: str
    ) -> Optional[str]:
        """Find a compatible voice for a model+language pair, preferring flagship."""
        await self._refresh()
        candidates = [
            v for v in self._voices.values()
            if v.model_id == model_id and v.language == language
        ]
        # Prefer flagship voices
        flagships = [v for v in candidates if v.flagship]
        if flagships:
            return flagships[0].voice_id
        if candidates:
            return candidates[0].voice_id
        return None

    def get_cache_status(self) -> Dict:
        return {
            "has_catalog": self._catalog_cache is not None,
            "has_details": self._details_cache is not None,
            "voice_count": len(self._voices),
            "last_fetch": self._last_fetch,
            "cache_ttl_seconds": self._cache_ttl,
            "catalog_url": CATALOG_URL,
            "details_url": DETAILS_URL,
            "api_key_required": False,  # catalog is keyless
        }


# Singleton instance
_catalog_service: Optional[VoiceCatalogService] = None


def get_catalog_service() -> VoiceCatalogService:
    global _catalog_service
    if _catalog_service is None:
        _catalog_service = VoiceCatalogService()
    return _catalog_service
