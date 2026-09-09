"""
VoicePilot AI — WebSocket Realtime Session Handler

Implements the full voice conversation loop:
  IDLE → LISTENING → PROCESSING → TOOL_EXECUTION → SPEAKING
  SPEAKING → INTERRUPTED → CANCELLING → LISTENING

Every async result is fenced by generation_id before affecting state.
"""
from __future__ import annotations

import asyncio
import base64
import json
import time
import uuid
from typing import Any, Dict, Optional

import structlog
from fastapi import WebSocket, WebSocketDisconnect

from app.agent.orchestrator import LocalAgent
from app.metrics.collector import MetricsCollector
from app.security.config import get_settings
from app.state.conversation_state import ConversationState, ConversationStatus
from app.tools.registry import get_tool_registry
from app.tts.rime_adapter import get_rime_adapter
from app.tts.speech_writer import prepare_for_speech
from app.voice_catalog.catalog_service import get_catalog_service

logger = structlog.get_logger(__name__)


class VoiceSession:
    """
    Manages one WebSocket voice session end-to-end.

    Message protocol (JSON over WebSocket):
      Client → Server:
        { type: "user_speech", text: "..." }         # STT result from browser
        { type: "interrupt" }                         # Barge-in signal
        { type: "update_voice", model, voice, lang }  # Voice switch
        { type: "ping" }
        { type: "demo_start" }                        # Demo mode trigger
        { type: "acceptance_test" }                   # Run acceptance test
        { type: "pronunciation_test", fixture_id }
        { type: "benchmark_request", text }

      Server → Client:
        { type: "state_change", status, ... }
        { type: "agent_thinking" }
        { type: "tool_start", tool_name, args }
        { type: "tool_complete", tool_name, result }
        { type: "agent_response", text, speech_text, generation_id }
        { type: "audio_chunk", data (base64), generation_id }
        { type: "audio_complete", generation_id }
        { type: "interruption_ack", new_generation_id }
        { type: "stale_rejected", source, generation_id }
        { type: "metrics", ... }
        { type: "observability_event", event }
        { type: "error", message }
        { type: "pong" }
        { type: "voice_config", rime_config, is_mock }
        { type: "acceptance_result", ... }
    """

    def __init__(self, websocket: WebSocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.state = ConversationState(conversation_id=session_id)
        self.metrics = MetricsCollector(session_id=session_id)
        self.rime = get_rime_adapter()
        self.registry = get_tool_registry()
        self.agent = LocalAgent(self.registry)
        self.catalog = get_catalog_service()
        self.settings = get_settings()
        self._alive = True
        self._audio_cancel: Optional[asyncio.Event] = None

        # Initialize voice config from settings
        self.state.update_rime_config(
            model=self.settings.rime_model_id,
            voice=self.settings.rime_voice,
            language=self.settings.rime_language,
        )

    async def send(self, msg: Dict[str, Any]):
        """Send JSON message to client."""
        try:
            await self.websocket.send_text(json.dumps(msg))
        except Exception as e:
            logger.warning("ws_send_failed", error=str(e))

    async def emit_event(self, event_type: str, **data):
        """Emit observability event to both metrics and client."""
        ev = self.metrics.emit(
            event_type,
            turn_id=self.state.current_turn_id or "",
            generation_id=self.state.current_generation_id,
            **data,
        )
        await self.send({
            "type": "observability_event",
            "event": ev.to_dict(),
        })

    async def send_state(self, status: Optional[str] = None):
        """Broadcast current state to client."""
        state_dict = self.state.to_dict()
        if status:
            state_dict["status"] = status
        await self.send({"type": "state_change", **state_dict})

    async def run(self):
        """Main session loop."""
        logger.info("session_started", session_id=self.session_id)

        # Send initial voice config (no secrets)
        await self.send({
            "type": "voice_config",
            "rime_config": self.rime.config.to_dict(),
            "is_mock": self.rime.is_mock,
            "session_id": self.session_id,
        })
        await self.send_state("IDLE")

        # Preload voice catalog in background
        asyncio.create_task(self.catalog.ensure_loaded())

        try:
            while self._alive:
                try:
                    raw = await asyncio.wait_for(
                        self.websocket.receive_text(), timeout=30.0
                    )
                except asyncio.TimeoutError:
                    # Send keepalive
                    await self.send({"type": "pong", "keepalive": True})
                    continue

                msg = json.loads(raw)
                await self._handle_message(msg)

        except WebSocketDisconnect:
            logger.info("session_disconnected", session_id=self.session_id)
        except Exception as e:
            logger.error("session_error", session_id=self.session_id, error=str(e))
            await self.send({"type": "error", "message": str(e)})
        finally:
            self._alive = False
            await self._cleanup()

    async def _handle_message(self, msg: Dict):
        """Route incoming messages to handlers."""
        msg_type = msg.get("type", "")

        handlers = {
            "user_speech": self._handle_user_speech,
            "interrupt": self._handle_interrupt,
            "update_voice": self._handle_update_voice,
            "ping": self._handle_ping,
            "demo_start": self._handle_demo,
            "acceptance_test": self._handle_acceptance_test,
            "pronunciation_test": self._handle_pronunciation_test,
            "benchmark_request": self._handle_benchmark,
            "get_catalog": self._handle_get_catalog,
            "get_metrics": self._handle_get_metrics,
            "get_events": self._handle_get_events,
        }

        handler = handlers.get(msg_type)
        if handler:
            await handler(msg)
        else:
            await self.send({"type": "error", "message": f"Unknown message type: {msg_type}"})

    async def _handle_interrupt(self, msg: Dict):
        """Handle barge-in / interrupt signal."""
        interrupt_time = time.time()
        old_gen = self.state.current_generation_id

        # Cancel audio immediately
        if self._audio_cancel:
            self._audio_cancel.set()

        # Interrupt state
        new_gen = await self.state.interrupt()

        await self.emit_event(
            "interruption",
            old_generation_id=old_gen,
            new_generation_id=new_gen,
            interrupt_time=interrupt_time,
        )

        self.metrics.record_interruption(old_gen, new_gen, self.state.current_turn_id or "")

        await self.send({
            "type": "interruption_ack",
            "new_generation_id": new_gen,
            "old_generation_id": old_gen,
        })
        await self.send_state("INTERRUPTED")

        # Transition to CANCELLING, then LISTENING
        await asyncio.sleep(0.1)
        await self.state.set_status(ConversationStatus.CANCELLING)
        await self.send_state("CANCELLING")
        await asyncio.sleep(0.15)
        await self.state.set_status(ConversationStatus.LISTENING)
        await self.send_state("LISTENING")

    async def _handle_user_speech(self, msg: Dict):
        """Process user speech input (STT result from browser)."""
        text = msg.get("text", "").strip()
        if not text:
            return

        speech_end_time = time.time()
        was_interrupted = msg.get("was_interrupted", False)

        await self.state.set_status(ConversationStatus.PROCESSING)
        await self.emit_event("speech_received", text=text, speech_end_time=speech_end_time)

        # Start new turn
        turn = await self.state.start_turn(text)
        turn.metrics.speech_input_end = speech_end_time
        turn.metrics.stt_completion = time.time()

        await self.send({
            "type": "user_turn",
            "text": text,
            "turn_id": turn.turn_id,
            "generation_id": turn.generation_id,
        })
        await self.send_state("PROCESSING")

        # Run the full turn asynchronously
        asyncio.create_task(
            self._process_turn(text, turn.generation_id, was_interrupted)
        )

    async def _process_turn(
        self, user_text: str, generation_id: str, was_interrupted: bool
    ):
        """
        Full async turn processing with generation_id fencing throughout.
        This is the core voice-engineering pipeline.
        """
        try:
            await self.send({"type": "agent_thinking", "generation_id": generation_id})

            # Create cancel event for this generation's audio
            self._audio_cancel = asyncio.Event()
            cancel_event = self._audio_cancel

            # Track current metrics
            current_metrics = self.state._get_current_metrics()
            if current_metrics:
                current_metrics.reasoning_start = time.time()

            # ── Agent processing ─────────────────────────────────────────────
            response = await self.agent.process(
                user_text=user_text,
                generation_id=generation_id,
                conversation_history=self.state.get_context_summary(),
                is_generation_current=self.state.is_current_generation,
                on_tool_start=lambda name, args: self._on_tool_start(name, args, generation_id),
                on_tool_complete=lambda name, result: self._on_tool_complete(name, result, generation_id),
                cancel_event=cancel_event,
                was_interrupted=was_interrupted,
            )

            if current_metrics:
                current_metrics.reasoning_end = time.time()

            # ── Stale check after agent ───────────────────────────────────────
            if response.is_stale or self.state.reject_stale(generation_id, "agent_response"):
                self.metrics.record_stale_rejection("agent_response", generation_id)
                await self.send({
                    "type": "stale_rejected",
                    "source": "agent_response",
                    "generation_id": generation_id,
                })
                await self.emit_event("stale_result_rejected", source="agent_response")
                return

            if not response.text:
                return

            # ── Add to conversation ───────────────────────────────────────────
            await self.state.add_assistant_turn(response.text, generation_id)

            await self.send({
                "type": "agent_response",
                "text": response.text,
                "speech_text": response.speech_text,
                "generation_id": generation_id,
                "tool_name": response.tool_name,
            })

            # ── Rime TTS streaming ────────────────────────────────────────────
            await self.state.set_status(ConversationStatus.SPEAKING)
            await self.send_state("SPEAKING")

            if current_metrics:
                current_metrics.tts_request_start = time.time()

            await self.emit_event("tts_request_start", text_length=len(response.speech_text))

            # Stream audio to client
            first_chunk = True
            total_chunks = 0
            async for audio_chunk in self.rime.synthesize_stream(
                text=response.speech_text,
                model_id=self.state.model,
                voice=self.state.voice,
                language=self.state.language,
                cancel_event=cancel_event,
            ):
                # ── Per-chunk stale/cancel check ───────────────────────────
                if cancel_event.is_set():
                    await self.emit_event("audio_cancelled", reason="cancel_event")
                    return

                if self.state.reject_stale(generation_id, "audio_chunk"):
                    self.metrics.record_stale_rejection("audio_chunk", generation_id)
                    await self.send({
                        "type": "stale_rejected",
                        "source": "audio_chunk",
                        "generation_id": generation_id,
                    })
                    return

                if first_chunk:
                    first_chunk = False
                    if current_metrics:
                        current_metrics.tts_first_audio = time.time()
                        current_metrics.playback_start = time.time()
                    await self.emit_event("tts_first_audio")

                # Send audio chunk (base64 encoded)
                encoded = base64.b64encode(audio_chunk).decode()
                await self.send({
                    "type": "audio_chunk",
                    "data": encoded,
                    "generation_id": generation_id,
                    "chunk_index": total_chunks,
                })
                total_chunks += 1

            # ── Final stale check after all audio sent ───────────────────────
            if self.state.reject_stale(generation_id, "audio_complete"):
                return

            if current_metrics:
                current_metrics.playback_stop = time.time()
                current_metrics.turn_completion = time.time()

            await self.send({
                "type": "audio_complete",
                "generation_id": generation_id,
                "total_chunks": total_chunks,
            })

            await self.emit_event(
                "turn_complete",
                metrics=current_metrics.to_dict() if current_metrics else {},
            )

            # Send metrics
            if current_metrics:
                await self.send({
                    "type": "metrics",
                    "turn_metrics": current_metrics.to_dict(),
                    "session_summary": self.metrics.get_summary(),
                })

            await self.state.set_status(ConversationStatus.IDLE)
            await self.send_state("IDLE")

        except asyncio.CancelledError:
            logger.info("turn_task_cancelled", generation_id=generation_id)
        except Exception as e:
            logger.error("turn_error", error=str(e), generation_id=generation_id)
            await self.send({"type": "error", "message": f"Processing error: {e}"})
            await self.state.set_status(ConversationStatus.ERROR)
            await self.send_state("ERROR")
            # Auto-recover
            await asyncio.sleep(0.5)
            await self.state.set_status(ConversationStatus.IDLE)
            await self.send_state("IDLE")

    async def _on_tool_start(self, tool_name: str, args: Dict, generation_id: str):
        """Callback when a tool starts executing."""
        await self.state.set_status(ConversationStatus.TOOL_EXECUTION)
        await self.send({
            "type": "tool_start",
            "tool_name": tool_name,
            "args": args,
            "generation_id": generation_id,
        })
        await self.emit_event("tool_start", tool_name=tool_name)
        await self.send_state("TOOL_EXECUTION")

    async def _on_tool_complete(self, tool_name: str, result, generation_id: str):
        """Callback when a tool completes."""
        # Check staleness of tool result
        if self.state.reject_stale(generation_id, f"tool_{tool_name}"):
            self.metrics.record_stale_rejection(f"tool_{tool_name}", generation_id)
            await self.send({
                "type": "stale_rejected",
                "source": f"tool_{tool_name}",
                "generation_id": generation_id,
            })
            return

        await self.send({
            "type": "tool_complete",
            "tool_name": tool_name,
            "result": result.to_dict() if hasattr(result, "to_dict") else str(result),
            "generation_id": generation_id,
        })
        await self.emit_event(
            "tool_complete",
            tool_name=tool_name,
            success=result.success if hasattr(result, "success") else True,
        )

    async def _handle_update_voice(self, msg: Dict):
        """Update Rime voice configuration."""
        model = msg.get("model") or msg.get("model_id") or self.state.model
        voice = msg.get("voice", self.state.voice)
        language = msg.get("language", self.state.language)

        # Validate against catalog
        is_valid = await self.catalog.is_valid_combination(model, language, voice)
        if not is_valid:
            # Try to find a compatible voice
            compatible = await self.catalog.find_compatible_voice(model, language)
            if compatible:
                voice = compatible

        self.state.update_rime_config(model=model, voice=voice, language=language)
        self.rime.update_config(model_id=model, voice=voice, language=language)

        await self.send({
            "type": "voice_updated",
            "model": model,
            "voice": voice,
            "language": language,
            "valid_combination": is_valid,
        })
        await self.emit_event("voice_updated", model=model, voice=voice, language=language)

    async def _handle_ping(self, msg: Dict):
        await self.send({"type": "pong", "timestamp": time.time()})

    async def _handle_get_catalog(self, msg: Dict):
        """Send voice catalog to client."""
        models = await self.catalog.get_available_models()
        languages = await self.catalog.get_available_languages()
        cache_status = self.catalog.get_cache_status()
        await self.send({
            "type": "catalog_data",
            "models": models,
            "languages": languages,
            "cache_status": cache_status,
        })

    async def _handle_get_metrics(self, msg: Dict):
        await self.send({
            "type": "metrics",
            "session_summary": self.metrics.get_summary(),
            "state": self.state.to_dict(),
        })

    async def _handle_get_events(self, msg: Dict):
        limit = msg.get("limit", 100)
        event_type = msg.get("event_type")
        await self.send({
            "type": "events_data",
            "events": self.metrics.get_events(limit=limit, event_type=event_type),
        })

    async def _handle_demo(self, msg: Dict):
        """
        Demo mode: exercise the real backend path with a scripted sequence.
        Uses actual Rime TTS, real tool delay, real interruption.
        """
        demo_gen = self.state.current_generation_id
        await self.send({"type": "demo_started", "generation_id": demo_gen})
        await self.emit_event("demo_started")

        # Step 1: Greeting
        await self._handle_user_speech({
            "type": "user_speech",
            "text": "Hello, start a demo for me",
        })
        await asyncio.sleep(3)

        # Step 2: Start delayed tool to simulate long operation
        await self._handle_user_speech({
            "type": "user_speech",
            "text": "test delay 8",
        })

        # Step 3: Interrupt after 2s
        await asyncio.sleep(2)
        await self._handle_interrupt({})
        await asyncio.sleep(0.5)

        # Step 4: New instruction
        await self._handle_user_speech({
            "type": "user_speech",
            "text": "Actually, calculate 42 times 7 instead",
            "was_interrupted": True,
        })

        await self.send({"type": "demo_complete"})
        await self.emit_event("demo_complete")

    async def _handle_acceptance_test(self, msg: Dict):
        """
        Run the acceptance test scenario.
        Deterministic, machine-readable results.
        """
        from app.evaluation.acceptance import run_acceptance_test
        result = await run_acceptance_test(self)
        await self.send({
            "type": "acceptance_result",
            "result": result,
        })

    async def _handle_pronunciation_test(self, msg: Dict):
        """Synthesize pronunciation test fixture via Rime."""
        from app.tts.speech_writer import PRONUNCIATION_FIXTURES
        fixture_id = msg.get("fixture_id")

        fixture = next(
            (f for f in PRONUNCIATION_FIXTURES if f["id"] == fixture_id),
            None
        )
        if not fixture:
            await self.send({"type": "error", "message": f"Fixture not found: {fixture_id}"})
            return

        start = time.time()
        audio = await self.rime.synthesize_full(fixture["text"])
        duration = time.time() - start

        encoded = base64.b64encode(audio).decode()
        await self.send({
            "type": "pronunciation_result",
            "fixture": fixture,
            "audio_base64": encoded,
            "synthesis_time_ms": duration * 1000,
            "rime_config": self.rime.config.to_dict(),
            "is_mock": self.rime.is_mock,
        })

    async def _handle_benchmark(self, msg: Dict):
        """Run a basic benchmark measurement for given text."""
        text = msg.get("text", "Hello, this is a benchmark test.")
        speech_text = prepare_for_speech(text)

        start = time.time()
        cancel = asyncio.Event()
        first_chunk_time = None
        total_bytes = 0

        async for chunk in self.rime.synthesize_stream(speech_text, cancel_event=cancel):
            if first_chunk_time is None:
                first_chunk_time = time.time()
            total_bytes += len(chunk)

        end = time.time()

        await self.send({
            "type": "benchmark_result",
            "text": text,
            "speech_text": speech_text,
            "total_time_ms": (end - start) * 1000,
            "ttfa_ms": (first_chunk_time - start) * 1000 if first_chunk_time else None,
            "total_bytes": total_bytes,
            "rime_config": self.rime.config.to_dict(),
            "is_mock": self.rime.is_mock,
            "provider": "rime",
        })

    async def _cleanup(self):
        """Clean up resources on disconnect."""
        if self._audio_cancel:
            self._audio_cancel.set()
        logger.info("session_cleanup", session_id=self.session_id)
