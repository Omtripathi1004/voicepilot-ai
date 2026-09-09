#!/usr/bin/env python3
"""
VoicePilot AI — Voice Discovery Script

Queries Rime public catalog endpoints to discover available personas,
models (mist, arcana), and supported language variations.
"""
import asyncio
import json
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.voice_catalog.catalog_service import VoiceCatalogService


async def main():
    print("=" * 60)
    print("  VOICEPILOT AI -- RIME VOICE CATALOG DISCOVERY")
    print("=" * 60)

    service = VoiceCatalogService()
    voices = await service.get_voices()

    print(f"\nDiscovered {len(voices)} available voice personas:\n")
    print(f"{'Voice ID':<18} {'Model':<10} {'Lang':<8} {'Gender':<8} {'Display Name'}")
    print("-" * 65)

    for v in voices:
        vid = str(v.get('voice_id') or '')
        mid = str(v.get('model_id') or '')
        lang = str(v.get('language') or '')
        gen = str(v.get('gender') or 'N/A')
        disp = str(v.get('display_name') or '')
        print(f"{vid:<18} {mid:<10} {lang:<8} {gen:<8} {disp}")

    cache_file = os.path.join(os.path.dirname(__file__), "..", "backend", "app", "voice_catalog", "cached_catalog.json")
    with open(cache_file, "w") as f:
        json.dump(voices, f, indent=2)

    print(f"\nCached catalog exported to: {os.path.abspath(cache_file)}")


if __name__ == "__main__":
    asyncio.run(main())
