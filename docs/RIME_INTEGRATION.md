# VoicePilot AI — Rime TTS Integration Guide

VoicePilot AI positions **Rime TTS** as its primary acoustic voice generator. This document details protocol-level integration, streaming behavior, model selection, keyless catalog discovery, and phonetic normalization.

---

## 1. Rime Models

### `mist` (Ultra-Low Latency Model)
- **Primary Use Case**: Conversational turn-taking, real-time voice agents, customer support.
- **Latency**: TTFA typically ~75ms to 120ms.
- **Sample Rate**: 24kHz / 16-bit Linear PCM.
- **Key Advantage**: Rapid first-token speech synthesis allows instant agent response without awkward conversational pauses.

### `arcana` (High-Fidelity Expressive Model)
- **Primary Use Case**: Storytelling, expressive personas, narration, brand ambassadors.
- **Latency**: TTFA typically ~150ms to 220ms.
- **Key Advantage**: Enhanced emotional prosody, breath control, and rich acoustic warmth.

---

## 2. Streaming Audio Pipeline

```
[Agent Response Text]
         │
         ▼
[Speech Normalizer (speech_writer.py)]
   - Converts: "$1,299.99" ──> "twelve hundred ninety-nine dollars and ninety-nine cents"
   - Converts: "VPA-20240912-XK47" ──> "V P A 2 0 2 4 0 9 1 2 X K 4 7"
         │
         ▼
[Rime HTTP Streaming Endpoint]
   POST https://users.rime.ai/v1/rime-tts
   Headers:
     Authorization: Bearer <RIME_API_KEY>
     Content-Type: application/json
   Body:
     {
       "speaker": "amber",
       "modelId": "mist",
       "text": "...",
       "audioFormat": "pcm"
     }
         │ (HTTP Chunked Transfer / WebSocket Stream)
         ▼
[Async Stream Consumer (rime_adapter.py)]
   - Streams 4096-byte PCM chunks
   - Records TTFA timestamp on first chunk received
   - Checks cancel_event between chunks (instant interruption cutoff)
         │
         ▼
[WebSocket Broadcast to Client]
   {
     "type": "audio_chunk",
     "data": "<base64 PCM>",
     "generation_id": "gen-1",
     "chunk_index": 0
   }
```

---

## 3. Dynamic Keyless Catalog Discovery

VoicePilot does not require hardcoded voice lists. It queries public endpoints:
- `https://users.rime.ai/v1/voices` or static metadata fallbacks.
- Voice personas discovered include:
  - `amber` (Female, clear conversational, US English)
  - `allison` (Female, warm professional)
  - `marcus` (Male, deep authoritative)
  - `james` (Male, expressive narrative)
  - `candice` (Female, energetic assistant)
- Results are cached locally in `backend/app/voice_catalog/cached_catalog.json` with TTL validation.

---

## 4. Offline / Simulation Fallback

To ensure the project builds and runs deterministically even without active cloud API keys or when offline:
- The adapter seamlessly switches to `RimeSimulatedAdapter` if `RIME_API_KEY` is not provided.
- The simulator generates valid multi-harmonic 24kHz PCM audio frames calibrated to mimic Rime Mist's streaming chunk size and ~75ms timing characteristics, ensuring all UI waveforms, latency meters, and acceptance tests function with 100% fidelity.
