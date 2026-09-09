"""
VoicePilot AI — Unit Tests: Voice Catalog

Tests catalog parsing, caching, and fallback behavior.
"""
import asyncio
import json
import pytest
import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from app.voice_catalog.catalog_service import VoiceCatalogService, CATALOG_URL, DETAILS_URL

# Sample data matching the real Rime catalog format
SAMPLE_CATALOG = {
    "mist": {
        "eng": ["luna", "echo", "nova"],
        "fra": ["celestine"],
    },
    "arcas": {
        "eng": ["atlas", "soleil"],
        "deu": ["heidi"],
    }
}

SAMPLE_DETAILS = {
    "luna": {
        "gender": "female",
        "age": "young adult",
        "dialect": "american",
        "flagship": True,
        "display_name": "Luna",
    },
    "echo": {
        "gender": "male",
        "age": "adult",
        "dialect": "american",
        "flagship": False,
        "display_name": "Echo",
    },
    "nova": {
        "gender": "female",
        "age": "adult",
        "dialect": "british",
        "flagship": False,
        "display_name": "Nova",
    },
    "celestine": {
        "gender": "female",
        "age": "adult",
        "dialect": "parisian",
        "flagship": True,
        "display_name": "Celestine",
    },
    "atlas": {
        "gender": "male",
        "age": "adult",
        "dialect": "american",
        "flagship": False,
        "display_name": "Atlas",
    },
    "soleil": {
        "gender": "female",
        "age": "young adult",
        "dialect": "american",
        "flagship": True,
        "display_name": "Soleil",
    },
    "heidi": {
        "gender": "female",
        "age": "adult",
        "dialect": "german",
        "flagship": False,
        "display_name": "Heidi",
    },
}


@pytest.fixture
async def catalog_service():
    """Create a catalog service with mocked HTTP."""
    service = VoiceCatalogService(cache_ttl_seconds=3600)

    async def mock_fetch(url: str):
        if "all-v2" in url:
            return SAMPLE_CATALOG
        elif "voice_details" in url:
            return SAMPLE_DETAILS
        return None

    service._fetch_json = mock_fetch
    await service._refresh(force=True)
    return service


class TestVoiceCatalogParsing:
    @pytest.mark.asyncio
    async def test_models_discovered(self, catalog_service):
        models = await catalog_service.get_available_models()
        assert "mist" in models
        assert "arcas" in models
        assert len(models) == 2

    @pytest.mark.asyncio
    async def test_languages_discovered(self, catalog_service):
        languages = await catalog_service.get_available_languages()
        assert "eng" in languages
        assert "fra" in languages
        assert "deu" in languages

    @pytest.mark.asyncio
    async def test_voices_for_model(self, catalog_service):
        voices = await catalog_service.get_voices_for_model("mist")
        voice_ids = [v["voice_id"] for v in voices]
        assert "luna" in voice_ids
        assert "echo" in voice_ids
        assert "nova" in voice_ids

    @pytest.mark.asyncio
    async def test_voices_for_language(self, catalog_service):
        voices = await catalog_service.get_voices_for_language("fra")
        voice_ids = [v["voice_id"] for v in voices]
        assert "celestine" in voice_ids

    @pytest.mark.asyncio
    async def test_voice_metadata_populated(self, catalog_service):
        details = await catalog_service.get_voice_details("luna")
        assert details is not None
        assert details["gender"] == "female"
        assert details["flagship"] is True
        assert details["voice_id"] == "luna"
        assert details["model_id"] == "mist"
        assert details["language"] == "eng"

    @pytest.mark.asyncio
    async def test_voice_model_language_association(self, catalog_service):
        details = await catalog_service.get_voice_details("celestine")
        assert details["model_id"] == "arcas" or details["model_id"] == "mist"
        assert details["language"] == "fra"


class TestMetadataMatching:
    @pytest.mark.asyncio
    async def test_valid_combination_check(self, catalog_service):
        is_valid = await catalog_service.is_valid_combination("mist", "eng", "luna")
        assert is_valid is True

    @pytest.mark.asyncio
    async def test_invalid_combination_rejected(self, catalog_service):
        # luna is not in arcas/eng
        is_valid = await catalog_service.is_valid_combination("arcas", "eng", "luna")
        assert is_valid is False

    @pytest.mark.asyncio
    async def test_wrong_language_combination_rejected(self, catalog_service):
        # celestine is fra, not eng
        is_valid = await catalog_service.is_valid_combination("mist", "eng", "celestine")
        assert is_valid is False

    @pytest.mark.asyncio
    async def test_find_compatible_voice_flagship_preferred(self, catalog_service):
        voice = await catalog_service.find_compatible_voice("mist", "eng")
        # luna is flagship, should be preferred
        assert voice == "luna"

    @pytest.mark.asyncio
    async def test_find_compatible_voice_fallback(self, catalog_service):
        # For non-flagship language, any voice OK
        voice = await catalog_service.find_compatible_voice("mist", "fra")
        assert voice == "celestine"

    @pytest.mark.asyncio
    async def test_nonexistent_model_returns_none(self, catalog_service):
        voice = await catalog_service.find_compatible_voice("nonexistent", "eng")
        assert voice is None


class TestCatalogCacheBehavior:
    @pytest.mark.asyncio
    async def test_cache_populated_after_refresh(self, catalog_service):
        status = catalog_service.get_cache_status()
        assert status["has_catalog"] is True
        assert status["has_details"] is True
        assert status["voice_count"] > 0

    @pytest.mark.asyncio
    async def test_cache_uses_keyless_urls(self, catalog_service):
        status = catalog_service.get_cache_status()
        assert status["api_key_required"] is False
        assert "all-v2.json" in status["catalog_url"]
        assert "voice_details.json" in status["details_url"]

    @pytest.mark.asyncio
    async def test_fallback_to_stale_cache_on_fetch_failure(self):
        """Service should fall back to last valid cache if fetch fails."""
        service = VoiceCatalogService(cache_ttl_seconds=3600)

        # First load succeeds
        async def good_fetch(url):
            if "all-v2" in url:
                return SAMPLE_CATALOG
            return SAMPLE_DETAILS

        service._fetch_json = good_fetch
        await service._refresh(force=True)
        assert service._catalog_cache is not None
        initial_voices = len(service._voices)

        # Now fetch fails
        async def bad_fetch(url):
            return None

        service._fetch_json = bad_fetch
        service._last_fetch = 0  # Force refresh attempt
        await service._refresh(force=True)

        # Cache should still have old data
        assert service._catalog_cache is not None
        assert len(service._voices) == initial_voices

    @pytest.mark.asyncio
    async def test_missing_voice_details_handled_gracefully(self):
        """Catalog without details should still work."""
        service = VoiceCatalogService()

        async def partial_fetch(url):
            if "all-v2" in url:
                return SAMPLE_CATALOG
            return {}  # empty details

        service._fetch_json = partial_fetch
        await service._refresh(force=True)

        # Should still have voices from catalog
        assert len(service._voices) > 0
        models = await service.get_available_models()
        assert "mist" in models

    @pytest.mark.asyncio
    async def test_invalid_catalog_data_handled(self):
        """Malformed catalog data should not crash."""
        service = VoiceCatalogService()

        async def malformed_fetch(url):
            if "all-v2" in url:
                return {"model": "not-a-dict-it-should-be", "bad": [1, 2, 3]}
            return {}

        service._fetch_json = malformed_fetch
        await service._refresh(force=True)
        # Should not raise, just have empty/partial voices
        models = await service.get_available_models()
        # model key exists but has invalid value, so no voices built
        assert isinstance(models, list)
