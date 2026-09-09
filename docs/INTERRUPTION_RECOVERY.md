# VoicePilot AI — Low-Latency Interruption & Barge-In Recovery

A core design imperative of VoicePilot AI is eliminating conversational collision ("talking over each other") and ghost audio ("stale speech playing after an interruption").

---

## 1. The Barge-In Sequence (<100ms)

When a user interrupts while VoicePilot is speaking (either via browser VAD or the Interrupt button):

```
Time (ms)   Client                                Backend
────────────────────────────────────────────────────────────────────────
T = 0ms     VAD detects speech / Click Interrupt
T = 5ms     Stop local Web Audio Context          Send { type: "interrupt" }
            (Buffer emptied instantly)
T = 20ms                                          Receive interrupt frame
T = 25ms                                          Set cancel_event on TTS stream
T = 30ms                                          Increment: gen-1 -> gen-2
T = 35ms                                          Cancel ongoing tool tasks
T = 40ms                                          Record audio boundary
T = 45ms    Receive interruption_ack <─────────── Broadcast ack
T = 50ms    Enter LISTENING state                 Enter LISTENING state
```

---

## 2. In-Flight Stale Chunk Rejection Proof

Consider a scenario where the backend has sent Chunk #4 of `gen-1` over TCP right before the interruption arrived.

1. The client receives Chunk #4 with metadata `generation_id: "gen-1"`.
2. The client checks `useConversationStore.getState().currentGenerationId`, which has already transitioned to `"gen-2"`.
3. Since `"gen-1"` $\neq$ `"gen-2"`, the client:
   - Discards the audio bytes immediately without passing to the Web Audio `AudioContext`.
   - Dispatches a `stale_rejected` telemetry event.
   - Increments the `stale_rejections` counter in the observability store.

This provides mathematically proven fencing against race conditions and network latency spikes.
