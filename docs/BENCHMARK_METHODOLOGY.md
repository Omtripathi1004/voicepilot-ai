# VoicePilot AI — Empirical Benchmark Methodology

This document defines the measurement protocols used to evaluate the voice pipeline, TTFA, and barge-in responsiveness.

---

## 1. Metrics Definitions

### A. Time-to-First-Audio (TTFA)
$$\text{TTFA} = T_{\text{first\_pcm\_chunk\_received}} - T_{\text{user\_speech\_end}}$$
- Measures the perceptible latency between the user stopping their utterance and the very first byte of acoustic speech reaching the listener's speakers.
- **Target**: $< 150\text{ ms}$ with Rime Mist.

### B. Cut-Off Latency
$$\text{Latency}_{\text{cutoff}} = T_{\text{audio\_silenced}} - T_{\text{barge\_in\_detected}}$$
- Measures how fast all ongoing speech is extinguished when the user speaks up.
- **Target**: $< 60\text{ ms}$.

### C. End-to-End Turn Duration
$$\text{Duration}_{\text{e2e}} = T_{\text{full\_response\_completed}} - T_{\text{user\_speech\_end}}$$

---

## 2. Test Harness Scenarios

| Scenario | Input Text | Focus |
|---|---|---|
| **Short Utterance** | *"Affirmative, calculation complete."* | Immediate ACK, cold start TTFA |
| **Medium Conversational** | *"VoicePilot detected the barge-in signal immediately..."* | Streaming throughput consistency |
| **Complex Technical** | *"Speech synthesis in real-time conversational agents..."* | Phonetic token density, buffer stability |
| **Tool Execution Turn** | *"Calculate (144 * 25) + 380"* | Asynchronous pipeline + math tool latency |
