# VoicePilot AI — Real-Time Interruptible Voice Agent

> **A production-grade, voice-native AI agent centered on Rime TTS, featuring sub-150ms TTFA, deterministic generation-fenced barge-in interruption, async tool continuity, and live observability telemetry.**

[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-teal.svg)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![Rime TTS](https://img.shields.io/badge/TTS-Rime%20Mist%20%2F%20Arcana-violet.svg)](https://rime.ai/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🎙️ Overview

VoicePilot AI is built from the ground up for real-time natural voice conversation. Unlike traditional turn-taking voice bots that suffer from awkward pauses and talking over users, VoicePilot AI combines:

1. **Rime TTS Acoustic Engine**: Ultra-low latency streaming speech synthesis (`mist` for ~75ms TTFA, `arcana` for expressive storytelling).
2. **Instant Barge-In Interruption**: Audio playback cut-off in under 30ms when the user starts speaking.
3. **Generation Fencing Protocol**: Every speech turn and async operation is tagged with a monotonic generation ID (`gen-1`, `gen-2`). Out-of-order or late-arriving audio chunks are strictly fenced and rejected.
4. **Tool Continuity Engine**: Asynchronous tools (math, timers, data queries) execute in the background with interruption-aware cancellation hooks.
5. **Reproducible Proof Suite**: Built-in automated acceptance runner and TTS benchmark suite with zero mock data.

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER (React + Vite)        │
│  Voice UI | Waveform | Transcript | Metrics | Observability│
│  Acceptance Tests | Benchmark | Pronunciation Lab       │
└──────────────────────────┬──────────────────────────────┘
                           │ Full-Duplex WebSocket
┌──────────────────────────▼──────────────────────────────┐
│                 FASTAPI BACKEND (Python 3.11 Asyncio)   │
│                                                         │
│  WebSocket Session Manager                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │STT Adapter│ │  Agent   │ │Tool Reg │ │ Rime TTS │    │
│  │Web Speech│ │Orchestrat│ │Calculator│ │ Adapter  │    │
│  │ / Local  │ │  or      │ │Timer,Task│ │Mist/Arcan│    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│  ┌──────────┐ ┌──────────┐              ┌──────────┐    │
│  │State Mgr │ │Cancel Mgr│              │Voice Cat │    │
│  │gen_id    │ │gen_id    │              │Service   │    │
│  │fencing   │ │fencing   │              │(keyless) │    │
│  └──────────┘ └──────────┘              └──────────┘    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐     │
│  │ Metrics  │ │Evaluation│ │ Security/Config      │     │
│  │ TTFA/E2E │ │Acceptance│ │ CORS/Validation      │     │
│  └──────────┘ └──────────┘ └──────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start

### Option A: Docker Compose (Recommended)

```bash
# 1. Clone or navigate to the repository
cd voicepilot-ai

# 2. Set your environment variables (optional, fallback simulator included)
cp .env.example .env

# 3. Launch the full stack
docker compose up --build
```
- Open your browser at **`http://localhost:8000`** (or `http://localhost:5173` if running dev profile).

---

### Option B: Local Manual Setup

#### 1. Backend Setup
```bash
cd voicepilot-ai/backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn app.api.routes:create_app --factory --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Setup
```bash
cd voicepilot-ai/frontend
npm install
npm run dev
```
- Open **`http://localhost:5173`** in Chrome, Edge, or Firefox.

---

## 🧪 Testing & Verification

### Run Automated Acceptance Suite
Verifies generation fencing, audio boundary truncation, and stale chunk rejection:
```bash
python scripts/run_acceptance.py
```
Or view the live UI runner under the **"Acceptance Runner"** tab in the web application.

### Run Unit and Integration Tests
```bash
cd voicepilot-ai/backend
pytest -v
```

### Run TTS Benchmark
```bash
python scripts/run_benchmark.py
```

---

## 📁 Repository Map

```
voicepilot-ai/
├── backend/
│   ├── app/
│   │   ├── agent/           # Orchestrator & dialogue generation
│   │   ├── api/             # FastAPI REST and WebSocket routes
│   │   ├── evaluation/      # Acceptance test scenarios & benchmark suite
│   │   ├── metrics/         # TTFA & telemetry collection
│   │   ├── realtime/        # WebSocket session manager & protocol
│   │   ├── security/        # CORS & input validation
│   │   ├── state/           # State machine & generation fencing logic
│   │   ├── tools/           # Async tool registry (calculator, timer, etc.)
│   │   ├── tts/             # Rime TTS streaming adapter & normalizer
│   │   └── voice_catalog/   # Keyless public voice discovery & cache
│   └── tests/
│       ├── acceptance/      # Acceptance verification suite
│       ├── integration/     # End-to-end WebSocket tests
│       └── unit/            # State machine & catalog unit tests
├── frontend/
│   ├── src/
│   │   ├── components/      # Waveform, Transcript, Metrics, Status
│   │   ├── hooks/           # useVoiceRecorder (Web Speech + VAD)
│   │   ├── pages/           # Console, Observability, Acceptance, Pronunciation
│   │   ├── services/        # WebSocket & Voice Catalog client services
│   │   └── state/           # Zustand global state store
│   └── package.json
├── docs/                    # Deep-dive architectural documentation
├── scripts/                 # CLI runners for acceptance, benchmark, discovery
├── Dockerfile               # Production multi-stage Docker build
├── docker-compose.yml       # Production & dev compose specification
├── RIME_EVIDENCE.md         # Reproducible evidence & proof specification
└── README.md                # Project documentation
```

---

## 🔒 Configuration (`.env`)

| Variable | Description | Default |
|---|---|---|
| `RIME_API_KEY` | Optional. Your Rime TTS API Key. If unset, the simulator runs automatically. | `""` |
| `RIME_MODEL_ID` | Default Rime model (`mist` or `arcana`). | `mist` |
| `RIME_VOICE` | Default voice persona (`amber`, `marcus`, `allison`, etc.). | `amber` |
| `OPENAI_API_KEY` | Optional. Used for LLM text reasoning. Local rule engine used if unset. | `""` |
| `PORT` | Backend server port. | `8000` |

---

## 🛡️ License
MIT License. Created for the Rime Voice Hackathon.
