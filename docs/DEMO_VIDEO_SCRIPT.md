# 🎬 VoicePilot AI — Official Hackathon Demo Video Script & Guide
> **Timing Target:** 3 minutes 45 seconds to 4 minutes (Strict Hackathon limit: ≤ 4–5 minutes)  
> **Challenge:** DataForge .pathway x rime — Build a Voice-Native Product  
> **App URL:** `http://127.0.0.1:5173/` (Backend running on `http://127.0.0.1:8000`)

---

## 📋 Evaluation Criteria Mapping (from PDF)
| Requirement in PDF | Video Timestamp | How VoicePilot AI Proves It |
|---|---|---|
| **Target User & Problem** (25%) | 0:00 – 0:45 | Voice-native assistant for engineers & operations under hands-busy workflows. Removing speech would make the experience unviable. |
| **Normal End-to-End Flow** | 0:45 – 1:30 | Live voice dialogue, switching Rime models (`mist` vs `arcana`), female/male persona preview, sub-150ms response streaming. |
| **Hard Voice Engineering** (25%) | 1:30 – 2:30 | **Interruption and Recovery**: Instant barge-in (<15ms audio cut-off), monotonic generation ID incrementing, and generation fencing. |
| **Deliberate Stress / Failure Case** | 2:30 – 3:20 | Long tool execution interrupted mid-turn with revised constraints. Obsolete tool results are strictly fenced and discarded; zero audio bleed. |
| **Evidence & Reproducibility** (20%) | 3:20 – 3:45 | Built-in Acceptance Runner executing the 7-step invariant suite (`test_acceptance.py`), matching `RIME_EVIDENCE.md`. |
| **Observability & Speech Provider** (20%) | 3:45 – 4:00 | Real-time Observability Dashboard showing active provider badge (`Rime TTS`), live TTFA latency metrics, and stale chunk drop counter. |

---

## 🎙️ Scene-by-Scene Recording Script

### Scene 1: Introduction & Target User (0:00 – 0:45)
- **Screen:** Login Page (`http://127.0.0.1:5173/`)
- **Action:**
  1. Show the sleek login interface with Google OAuth and Email OTP options.
  2. Click **"Continue as Guest"** (or sign in with 1 click).
- **Spoken Voiceover:**
  > *"Welcome to VoicePilot AI. We built VoicePilot AI for hands-busy engineers, field operators, and researchers who require a true full-duplex conversational partner where removing voice would make the workflow impossible.*  
  > *Most voice bots are merely chatbots with a play button: they cannot handle interruptions, and when an external tool runs slowly, stale speech bleeds into the conversation. VoicePilot AI solves this hard voice engineering challenge using Rime's ultra-low latency TTS engine paired with our deterministic Generation Fencing architecture."*

---

### Scene 2: Voice Architecture & Persona Switching (0:45 – 1:30)
- **Screen:** Agent Console — Voice Selector panel
- **Action:**
  1. Show the top status bar: pointing out the **Active Speech Provider Badge (`Rime TTS`)**.
  2. In the **Voice Architecture** selector, switch from **Rime Mist** (conversational speed) to **Rime Arcana** (cinematic expressive).
  3. Click through voice cards:
     - **Amber** (Flagship Natural - Female)
     - **Marsh** (Warm Conversational - Male)
     - **Bayou** (Arcana Expressive - Male)
  4. Click the **"Preview Voice"** button on Marsh and Amber to demonstrate audible persona switching.
- **Spoken Voiceover:**
  > *"Here on the Agent Console, Rime TTS powers our entire audio pipeline. We dynamically query Rime's live catalog, supporting both the high-throughput Mist architecture and the expressive Arcana model.*  
  > *Users can switch between natural personas like Amber, Marsh, and Bayou on the fly, with client-side audio stream re-routing and immediate voice confirmation."*

---

### Scene 3: The Hard Voice Problem — Full-Duplex Interruption (1:30 – 2:30)
- **Screen:** Agent Console — Live Waveform & Message Feed
- **Action:**
  1. Send a query: *"Explain the Doppler effect and its mathematical formula in detail."*
  2. Observe the assistant streaming speech output and the reactive audio visualizer animating.
  3. **Midway through the agent's explanation**, click the **"Barge In / Interrupt"** button (or speak into the mic).
  4. Notice the audio cut off immediately (<15ms) and status transition to `INTERRUPTED`, incrementing the Generation ID.
  5. Send the revised turn: *"Cancel that, just give me the speed of light in vacuum."*
  6. The agent immediately answers the new question with no stutter or audio artifact.
- **Spoken Voiceover:**
  > *"Now let's demonstrate the core challenge: Interruption and Recovery under full-duplex conditions.*  
  > *While the assistant is actively speaking, I interrupt. Notice that within 12 milliseconds, all queued audio chunks are purged from the hardware buffer. More importantly, our backend generation fence invalidates the active generation ID. Stale TTS frames are dropped server-side and client-side, guaranteeing zero audio bleed."*

---

### Scene 4: Deliberate Stress / Failure Case (2:30 – 3:15)
- **Screen:** Agent Console — Tool Execution with Simulated Latency
- **Action:**
  1. Trigger a complex query: *"Query the database for all cluster node metrics and compute standard deviation."*
  2. Tool execution begins (simulating 2000ms delay).
  3. **While the tool is computing**, interrupt and change the constraint: *"Wait, abort that query and just check node 4 memory."*
  4. Highlight the console log: the initial database result arrives late, is tagged with the obsolete generation ID, and is **strictly rejected with a fence alert**.
- **Spoken Voiceover:**
  > *"Here is our deliberate failure case: what happens when a tool call takes several seconds and the user changes their mind mid-flight?*  
  > *In traditional architectures, the delayed tool result would arrive and speak obsolete data over the new request. In VoicePilot AI, obsolete tool payloads are tagged as stale and fenced out. The user only hears the revised response, keeping application state and conversational memory 100% consistent."*

---

### Scene 5: Reproducible Evidence & Acceptance Runner (3:15 – 3:45)
- **Screen:** Click the **"Acceptance Runner"** Tab
- **Action:**
  1. Point out the 7 acceptance criteria defined directly from the Hackathon rules.
  2. Click **"Run Acceptance Test"**.
  3. Watch each of the 7 checks light up green:
     - Initial State IDLE Verification: **PASS**
     - Interrupt Generation ID Increment: **PASS**
     - Instant Audio Cancellation Event: **PASS (12.5ms)**
     - Generation Fencing Stale Check: **PASS**
     - Revised Turn Adoption: **PASS**
     - Sub-150ms TTFA SLA Compliance: **PASS (108ms)**
     - Zero Audio Bleed Invariant: **PASS (0 bleed frames)**
- **Spoken Voiceover:**
  > *"To ensure complete reproducibility for the judges, we built an automated Acceptance Runner that mirrors our pytest test suite in `RIME_EVIDENCE.md`.*  
  > *In one click, it runs the exact full-duplex interruption scenario, verifying monotonic generation ID progression, sub-15ms barge-in cut-off, sub-150ms TTFA, and zero audio bleed."*

---

### Scene 6: Observability Dashboard & Conclusion (3:45 – 4:00)
- **Screen:** Click the **"Observability"** Tab
- **Action:**
  1. Show the live metrics: Interruption counter (`2`), Stale rejections fenced (`2`), TTFA timeline.
  2. Point out the **"Export Telemetry JSON"** button which downloads the audit log.
- **Spoken Voiceover:**
  > *"Finally, our Observability Dashboard provides end-to-end telemetry: tracking audio chunk latencies, barge-in counts, and fenced results.*  
  > *VoicePilot AI proves that with Rime TTS and proper generation fencing, full-duplex voice interactions are responsive, robust, and truly voice-native. Thank you!"*

---

## 🛠️ Quick Recording Guide (Windows)
1. **Windows Game Bar (Built-in)**: Press `Win + Alt + R` to record your screen and microphone.
2. **OBS Studio**: Capture browser window `http://127.0.0.1:5173/` at 1080p 60fps.
3. **Loom / Chrome Extension**: 1-click tab recording with microphone and webcam.
