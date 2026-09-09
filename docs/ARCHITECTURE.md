# VoicePilot AI — Architecture & System Design

VoicePilot AI is a production-grade, real-time voice agent built around **Rime TTS**, engineered for natural conversational speed (<150ms Time-to-First-Audio), instantaneous barge-in interruption recovery, and generation-fenced tool execution.

```
+-------------------------------------------------------------------------+
|                      Client Browser (React 18 + Vite)                   |
|                                                                         |
|  [Microphone / Web Speech]   [Waveform Visualizer]   [Transcript UI]     |
|          |                            ^                      ^          |
|          v                            |                      |          |
|   useVoiceRecorder            Web Audio Player        Telemetry Stream  |
|          |                      (Stale Fenced)               |          |
+----------|----------------------------|----------------------|----------+
           | User Speech                | PCM Chunks           | Events
           | (JSON / Text)              | (Base64)             | (JSON)
           v                            |                      |
+-------------------------------------------------------------------------+
|                    FastAPI Backend (Asyncio WebSockets)                 |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                     VoiceSession Manager                          |  |
|  |   - Fencing State Machine (IDLE -> LISTENING -> SPEAKING -> ...)  |  |
|  |   - Generation Counter (gen_id increments on every barge-in)      |  |
|  +-------------------------------------------------------------------+  |
|          |                            |                       |         |
|          v                            v                       v         |
|  +---------------+          +--------------------+    +--------------+  |
|  | Tool Registry |          | Agent Orchestrator |    | Telemetry &  |  |
|  |  - Calculator |          |  - Text Processor  |    | Turn Metrics |  |
|  |  - Timer      |          |  - Fenced Tasks    |    |  - TTFA      |  |
|  |  - Task Mgr   |          +--------------------+    |  - Cut Latency| |
|  |  - Knowledge  |                    |               +--------------+  |
|  +---------------+                    v                                 |
|          |                   +--------------------+                     |
|          +------------------>|  Rime TTS Adapter  |                     |
|                              |  - Mist (~75ms)    |                     |
|                              |  - Arcana (~150ms) |                     |
|                              |  - Public Catalog  |                     |
|                              +--------------------+                     |
+-------------------------------------------------------------------------+
```

---

## 1. Core Subsystems

### A. Rime TTS Adapter (`backend/app/tts/rime_adapter.py`)
- **Streaming Audio Delivery**: Yields audio chunks as fast as Rime generates them over streaming HTTP/WebSocket connections.
- **Dynamic Voice Discovery**: Leverages public keyless catalog endpoints (`users.rime.ai`) with local disk caching and fallback schemas.
- **Model Architecture Support**:
  - `mist`: Optimized for conversational agents with TTFA under 100ms.
  - `arcana`: High expressivity and emotional range for rich storytelling and immersive characters.
- **Pronunciation Normalizer**: Pre-processes numbers (`$1,299.99` -> "twelve hundred ninety-nine dollars and ninety-nine cents"), technical abbreviations, identifiers, and dates before speech generation.

### B. Generation Fencing & Cancellation (`backend/app/state/conversation_state.py`)
- **Generation ID Guarantee**: Every interaction is tagged with an incrementing monotonically increasing generation ID (e.g., `gen-1`, `gen-2`).
- **Zero Ghost Speech**: Whenever the user barges in or issues an interruption:
  1. Current `generation_id` increments immediately.
  2. The TTS streaming task receives an `asyncio.Event` cancellation signal.
  3. Any in-flight or delayed chunks carrying the superseded generation ID are discarded by both the backend session router and the frontend audio buffer player.

### C. Tool Continuity Engine (`backend/app/tools/`)
- Asynchronous tool execution registry (Calculator, Timer, Task Manager, Knowledge Retrieval, and Test Delay).
- When an interruption occurs while a long-running tool is processing, the orchestrator cancels the task if discardable, or marks the output as *fenced* so it does not hijack the new dialogue turn.

### D. Real-Time Observability (`backend/app/metrics/`)
- Measures empirical timestamps across each phase of the pipeline:
  - STT Latency
  - LLM Reasoning Latency
  - Time-to-First-Audio (TTFA)
  - Audio Cut-Off Latency (interruption detection to silence)
  - Stale Chunk Rejections Count
