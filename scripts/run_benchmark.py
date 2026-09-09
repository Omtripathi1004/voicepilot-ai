#!/usr/bin/env python3
"""
VoicePilot AI — TTS Latency & TTFA Benchmark CLI

Streams TTS audio chunks directly from Rime TTS and measures:
- Time-To-First-Audio (TTFA)
- Total synthesis duration
- Audio throughput in KB/s
- First chunk byte size
"""
import asyncio
import os
import sys
import time

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.tts.rime_adapter import get_rime_adapter
from app.tts.speech_writer import prepare_for_speech

BENCHMARK_CASES = [
    ("Short Affirmation", "Affirmative, calculation complete."),
    ("Medium Conversational Turn", "VoicePilot detected the barge-in signal immediately and fenced off the prior generation without dropping WebSocket frames."),
    ("Complex Technical Paragraph", "Speech synthesis in real-time conversational agents requires minimizing Time-to-First-Audio to under two hundred milliseconds. Rime Mist provides ultra-fast generation suitable for live barge-in interruptions."),
]


async def benchmark_sentence(adapter, title, text):
    speech_text = prepare_for_speech(text)
    cancel = asyncio.Event()

    t_start = time.time()
    first_chunk_time = None
    first_chunk_bytes = 0
    total_bytes = 0
    chunks = 0

    async for chunk in adapter.synthesize_stream(speech_text, cancel_event=cancel):
        if first_chunk_time is None:
            first_chunk_time = time.time()
            first_chunk_bytes = len(chunk)
        total_bytes += len(chunk)
        chunks += 1

    t_end = time.time()

    ttfa_ms = (first_chunk_time - t_start) * 1000 if first_chunk_time else 0
    total_ms = (t_end - t_start) * 1000
    throughput = (total_bytes / 1024) / (total_ms / 1000) if total_ms > 0 else 0

    return {
        "title": title,
        "text": text,
        "ttfa_ms": ttfa_ms,
        "total_ms": total_ms,
        "chunks": chunks,
        "first_chunk_bytes": first_chunk_bytes,
        "total_bytes": total_bytes,
        "throughput_kb_s": throughput,
    }


async def main():
    print("=" * 70)
    print("  VOICEPILOT AI -- RIME TTS EMPIRICAL BENCHMARK")
    print("=" * 70)

    adapter = get_rime_adapter()
    cfg = adapter.config
    print(f"Model: {cfg.model_id} | Voice: {cfg.voice} | Engine: {'Simulated' if adapter.is_mock else 'Live Rime Cloud'}")
    print("-" * 70)

    for title, text in BENCHMARK_CASES:
        res = await benchmark_sentence(adapter, title, text)
        print(f"\nScenario: {res['title']}")
        print(f"Input: \"{res['text']}\"")
        print(f"  * TTFA (Time to 1st Audio): {res['ttfa_ms']:.1f} ms  (Target < 150ms)")
        print(f"  * Total Duration:          {res['total_ms']:.1f} ms")
        print(f"  * Audio Chunks:            {res['chunks']} chunks ({res['first_chunk_bytes']} B in 1st chunk)")
        print(f"  * Total Data:              {res['total_bytes'] / 1024:.1f} KB")
        print(f"  * Streaming Throughput:    {res['throughput_kb_s']:.1f} KB/s")

    print("\n" + "=" * 70)
    print("Benchmark complete.")


if __name__ == "__main__":
    asyncio.run(main())
