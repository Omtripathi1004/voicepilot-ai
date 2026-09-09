# VoicePilot AI — Conversation State Machine Specification

VoicePilot AI enforces a deterministic finite state machine (FSM) to manage full-duplex speech interaction without race conditions.

```
       +-------------------------------------------------------+
       |                                                       |
       v                                                       |
   [ IDLE ] --(User Speech Start)--> [ LISTENING ]             |
       ^                                    |                  |
       |                             (Speech End)              |
       |                                    v                  |
       |                            [ PROCESSING ]             |
       |                             /          \              |
       |               (Tool Needed)/            \(Direct TTS) |
       |                           v              v            |
       |                [ TOOL_EXECUTION ]    [ SPEAKING ]<----+
       |                           \              /  |
       |                            \            /   | (User Barge-In)
       |                             \          /    v
       |                              \        +->[ INTERRUPTED ]
       |                               \                 |
       |                                \                v
       |                                 +----->[ CANCELLING / FENCING ]
       |                                                 |
       |                                                 v
       +----------------(Cycle Complete)----------[ LISTENING ]
```

---

## 1. Valid States

| State | Description | Invariants |
|---|---|---|
| `IDLE` | Agent is idle waiting for user speech or typed input. | Audio buffer empty, mic may be dormant or in VAD standby. |
| `LISTENING` | User is actively speaking. Audio is streaming from browser. | `interimTranscript` updating; TTS playback silenced. |
| `PROCESSING` | Backend is reasoning or determining tool execution. | Agent response generation task active. |
| `TOOL_EXECUTION` | Asynchronous external tool call in progress. | Bound to current `generation_id`. |
| `SPEAKING` | Rime TTS streaming PCM audio playback to client. | Streaming chunks matching current `generation_id` are played. |
| `INTERRUPTED` | Barge-in trigger received (VAD speech or manual interrupt). | Playback cancelled immediately (<100ms); gen counter incremented. |
| `CANCELLING` | In-flight async tasks fenced and cancelled. | Any responses from previous generation marked stale and rejected. |
| `ERROR` | Recoverable error state. | Logged, notified, auto-recovers to `IDLE`. |

---

## 2. Generation Fencing Invariant

For every chunk $C$ received by the audio playback engine:
$$\text{Action}(C) = \begin{cases} \text{Play}(C) & \text{if } C.\text{generation\_id} == \text{CurrentGenerationID} \\ \text{Reject}(C) & \text{if } C.\text{generation\_id} \neq \text{CurrentGenerationID} \end{cases}$$

This mathematical invariant ensures that even if network packets arrive out-of-order over WebSocket, old speech audio will **never** be played after an interruption.
