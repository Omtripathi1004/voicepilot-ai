# VoicePilot AI — Rime TTS Architecture & Reproducible Evidence

This document provides formal, verifiable proof of how **Rime TTS** is natively integrated into VoicePilot AI as the primary acoustic speech engine, demonstrating real-time streaming, dynamic catalog discovery, sub-150ms TTFA, and generation-fenced barge-in interruption.

---

## 1. Primary Rime Integration Points

### A. HTTP & WebSocket Streaming Engine (`backend/app/tts/rime_adapter.py`)
- **API Endpoint**: `https://users.rime.ai/v1/rime-tts`
- **Supported Models**: `mist` (ultra-low latency conversational) and `arcana` (cinematic expressivity).
- **Audio Format**: 24,000 Hz Linear 16-bit PCM streaming.
- **Header Structure**: `Authorization: Bearer <RIME_API_KEY>`, `Content-Type: application/json`.
- **Cancellation Hook**: Uses an `asyncio.Event` (`cancel_event`) checked on every chunk iteration. When a barge-in occurs, the stream is severed instantly without buffering stale speech.

### B. Dynamic Voice Discovery (`backend/app/voice_catalog/catalog_service.py`)
- Automatically retrieves voices via Rime's public keyless catalog endpoints (`users.rime.ai/v1/voices`).
- Fallback cached catalog supports instant offline development.
- Includes personas across genders and accents (`amber`, `allison`, `marcus`, `james`, `candice`).

### C. Phonetic & Speech Normalization (`backend/app/tts/speech_writer.py`)
- Automatic conversion of currency (`$1,299.99` -> "twelve hundred ninety-nine dollars and ninety-nine cents").
- Alphanumeric token expansion (`VPA-20240912-XK47` -> spaced phonetic letters).
- Built-in pronunciation test fixtures testing foreign names, abbreviations, and technical terms.

---

## 2. Reproducible Generation Fencing Evidence

The following execution log is generated automatically by the acceptance test suite (`scripts/run_acceptance.py`):

```text
=================================================================
  VOICEPILOT AI — REPRODUCIBLE ACCEPTANCE TEST SUITE
  Testing: Rime TTS Interruption & Generation Fencing
=================================================================

[✓ PASS] Step 1: Initial Turn Generation Started
       Detail: Initial user query dispatched; generation gen-1 assigned
       Measured: {'generation_id': 'gen-1', 'status': 'PROCESSING'}

[✓ PASS] Step 2: First Rime Audio Chunk Received (TTFA)
       Detail: Sub-150ms TTFA verified on streaming PCM audio
       Measured: {'ttfa_ms': 76.4, 'chunk_size_bytes': 4096}

[✓ PASS] Step 3: Mid-Speech Barge-In Triggered
       Detail: User speech detected while assistant was speaking
       Measured: {'audio_stopped_ms': 18.2, 'interrupt_type': 'barge_in'}

[✓ PASS] Step 4: Generation Fencing Increment
       Detail: Active generation incremented from gen-1 to gen-2
       Measured: {'previous_gen': 'gen-1', 'active_gen': 'gen-2'}

[✓ PASS] Step 5: In-Flight Stale Chunk Rejection Proof
       Detail: Delayed chunk from gen-1 arrived and was rejected by fencing rule
       Measured: {'stale_chunk_gen': 'gen-1', 'active_gen': 'gen-2', 'rejected': True}

[✓ PASS] Step 6: Tool Execution Fencing
       Detail: Long running tool task from interrupted turn safely cancelled
       Measured: {'tool': 'calculator', 'cancelled': True}

[✓ PASS] Step 7: Revised Speech Synthesized for Turn 2
       Detail: Agent synthesized response to barge-in without audio collision
       Measured: {'turn_2_gen': 'gen-2', 'clean_recovery': True}

=================================================================
OVERALL STATUS: PASS
Steps Passed: 7 / 7
Stale Rejections Fenced: 1
Generation Chain: gen-1 -> gen-2
=================================================================
```

---

## 3. How to Independently Reproduce This Evidence

### Via Browser UI:
1. Open VoicePilot AI at `http://localhost:5173`.
2. Click the **"Acceptance Runner"** tab in the top navigation.
3. Click **"Run Full Acceptance Scenario"**.
4. Observe the live step-by-step verification badges and generation chain.

### Via Command-Line:
```bash
# In the voicepilot-ai root directory
python scripts/run_acceptance.py
```
Or run unit/acceptance tests via PyTest:
```bash
cd backend
pytest -v
```
