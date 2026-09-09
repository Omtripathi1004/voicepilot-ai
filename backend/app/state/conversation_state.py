"""
VoicePilot AI — Conversation State

Defines the complete state machine for a voice conversation session.
Every turn has generation_id for stale-result fencing.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class ConversationStatus(str, Enum):
    IDLE = "IDLE"
    LISTENING = "LISTENING"
    PROCESSING = "PROCESSING"
    TOOL_EXECUTION = "TOOL_EXECUTION"
    SPEAKING = "SPEAKING"
    INTERRUPTED = "INTERRUPTED"
    CANCELLING = "CANCELLING"
    ERROR = "ERROR"


class TurnRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"
    SYSTEM = "system"


@dataclass
class ToolExecution:
    tool_id: str
    tool_name: str
    args: Dict[str, Any]
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    cancelled: bool = False
    stale: bool = False
    cancel_event: Optional[asyncio.Event] = field(default=None, repr=False)

    def __post_init__(self):
        if self.cancel_event is None:
            self.cancel_event = asyncio.Event()

    @property
    def duration_ms(self) -> Optional[float]:
        if self.end_time:
            return (self.end_time - self.start_time) * 1000
        return None


@dataclass
class TurnMetrics:
    turn_id: str
    generation_id: str
    speech_input_end: Optional[float] = None
    stt_completion: Optional[float] = None
    reasoning_start: Optional[float] = None
    reasoning_end: Optional[float] = None
    tool_start: Optional[float] = None
    tool_end: Optional[float] = None
    tts_request_start: Optional[float] = None
    tts_first_audio: Optional[float] = None
    playback_start: Optional[float] = None
    playback_stop: Optional[float] = None
    turn_completion: Optional[float] = None
    interruption_detected: Optional[float] = None
    audio_stop: Optional[float] = None
    stale_rejections: int = 0

    @property
    def ttfa_ms(self) -> Optional[float]:
        if self.tts_first_audio and self.speech_input_end:
            return (self.tts_first_audio - self.speech_input_end) * 1000
        return None

    @property
    def stt_latency_ms(self) -> Optional[float]:
        if self.stt_completion and self.speech_input_end:
            return (self.stt_completion - self.speech_input_end) * 1000
        return None

    @property
    def reasoning_latency_ms(self) -> Optional[float]:
        if self.reasoning_end and self.reasoning_start:
            return (self.reasoning_end - self.reasoning_start) * 1000
        return None

    @property
    def tool_latency_ms(self) -> Optional[float]:
        if self.tool_end and self.tool_start:
            return (self.tool_end - self.tool_start) * 1000
        return None

    @property
    def tts_latency_ms(self) -> Optional[float]:
        if self.tts_first_audio and self.tts_request_start:
            return (self.tts_first_audio - self.tts_request_start) * 1000
        return None

    @property
    def end_to_end_latency_ms(self) -> Optional[float]:
        if self.turn_completion and self.speech_input_end:
            return (self.turn_completion - self.speech_input_end) * 1000
        return None

    @property
    def interruption_detection_latency_ms(self) -> Optional[float]:
        if self.interruption_detected and self.playback_start:
            return (self.interruption_detected - self.playback_start) * 1000
        return None

    @property
    def audio_stop_latency_ms(self) -> Optional[float]:
        if self.audio_stop and self.interruption_detected:
            return (self.audio_stop - self.interruption_detected) * 1000
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "turn_id": self.turn_id,
            "generation_id": self.generation_id,
            "ttfa_ms": self.ttfa_ms,
            "stt_latency_ms": self.stt_latency_ms,
            "reasoning_latency_ms": self.reasoning_latency_ms,
            "tool_latency_ms": self.tool_latency_ms,
            "tts_latency_ms": self.tts_latency_ms,
            "end_to_end_latency_ms": self.end_to_end_latency_ms,
            "interruption_detection_latency_ms": self.interruption_detection_latency_ms,
            "audio_stop_latency_ms": self.audio_stop_latency_ms,
            "stale_rejections": self.stale_rejections,
        }


@dataclass
class ConversationTurn:
    turn_id: str
    role: TurnRole
    text: str
    generation_id: str
    timestamp: float = field(default_factory=time.time)
    heard_boundary: Optional[int] = None  # char index of last heard content
    tool_executions: List[ToolExecution] = field(default_factory=list)
    metrics: Optional[TurnMetrics] = None
    interrupted: bool = False
    stale: bool = False


class ConversationState:
    """
    Full mutable state for one voice session.

    Thread-safe via asyncio.Lock for all mutations.
    The generation_id MUST be checked before any async result affects state.
    """

    def __init__(self, conversation_id: str):
        self.conversation_id = conversation_id
        self.status = ConversationStatus.IDLE
        self._lock = asyncio.Lock()

        # Turn tracking
        self.turns: List[ConversationTurn] = []
        self.current_turn_id: Optional[str] = None
        self.current_generation_id: str = self._new_id()

        # Active tasks (for cancellation)
        self.active_tool_tasks: Dict[str, asyncio.Task] = {}
        self.active_tts_task: Optional[asyncio.Task] = None

        # Current Rime config
        self.provider: str = "rime"
        self.model: str = ""
        self.voice: str = ""
        self.language: str = ""

        # Statistics
        self.total_interruptions: int = 0
        self.total_stale_rejections: int = 0
        self.total_turns: int = 0

        self._metrics_by_turn: Dict[str, TurnMetrics] = {}

    @staticmethod
    def _new_id() -> str:
        return str(uuid.uuid4())

    async def start_turn(self, user_text: str) -> ConversationTurn:
        """Begin a new user turn. Returns the new turn object."""
        async with self._lock:
            self.total_turns += 1
            turn_id = self._new_id()
            gen_id = self.current_generation_id
            self.current_turn_id = turn_id

            metrics = TurnMetrics(turn_id=turn_id, generation_id=gen_id)
            metrics.speech_input_end = time.time()

            turn = ConversationTurn(
                turn_id=turn_id,
                role=TurnRole.USER,
                text=user_text,
                generation_id=gen_id,
                metrics=metrics,
            )
            self.turns.append(turn)
            self._metrics_by_turn[turn_id] = metrics
            self.status = ConversationStatus.PROCESSING
            return turn

    async def interrupt(self) -> str:
        """
        Interrupt current operation.
        Increments generation_id, cancels active tasks.
        Returns new generation_id.
        """
        async with self._lock:
            old_gen = self.current_generation_id
            self.current_generation_id = self._new_id()
            self.status = ConversationStatus.INTERRUPTED
            self.total_interruptions += 1

            # Mark current turn as interrupted
            if self.turns:
                for t in reversed(self.turns):
                    if t.generation_id == old_gen:
                        t.interrupted = True
                        break

            # Cancel TTS task
            if self.active_tts_task and not self.active_tts_task.done():
                self.active_tts_task.cancel()
                self.active_tts_task = None

            # Signal tool cancellations
            for tool_exec in self._get_active_tool_executions(old_gen):
                tool_exec.cancel_event.set()
                tool_exec.cancelled = True

            return self.current_generation_id

    def _get_active_tool_executions(self, gen_id: str) -> List[ToolExecution]:
        results = []
        for turn in self.turns:
            if turn.generation_id == gen_id:
                for te in turn.tool_executions:
                    if not te.cancelled and te.end_time is None:
                        results.append(te)
        return results

    def is_current_generation(self, generation_id: str) -> bool:
        """Check if a generation_id is still current (not stale)."""
        return generation_id == self.current_generation_id

    def reject_stale(self, generation_id: str, source: str) -> bool:
        """
        Check if result is stale. If so, increment rejection counter.
        Returns True if stale (should be rejected).
        """
        if not self.is_current_generation(generation_id):
            self.total_stale_rejections += 1
            current_metrics = self._get_current_metrics()
            if current_metrics:
                current_metrics.stale_rejections += 1
            return True
        return False

    def _get_current_metrics(self) -> Optional[TurnMetrics]:
        if self.current_turn_id:
            return self._metrics_by_turn.get(self.current_turn_id)
        return None

    async def set_status(self, status: ConversationStatus):
        async with self._lock:
            self.status = status

    async def add_assistant_turn(
        self, text: str, generation_id: str
    ) -> Optional[ConversationTurn]:
        """Add assistant response turn. Returns None if stale."""
        async with self._lock:
            if self.reject_stale(generation_id, "assistant_turn"):
                return None
            turn = ConversationTurn(
                turn_id=self._new_id(),
                role=TurnRole.ASSISTANT,
                text=text,
                generation_id=generation_id,
            )
            self.turns.append(turn)
            return turn

    async def record_tool_execution(
        self, generation_id: str, tool_name: str, args: Dict
    ) -> Optional[ToolExecution]:
        """Register a tool execution for tracking. Returns None if stale gen."""
        async with self._lock:
            if not self.is_current_generation(generation_id):
                return None
            te = ToolExecution(
                tool_id=self._new_id(),
                tool_name=tool_name,
                args=args,
            )
            # Attach to current user turn
            for t in reversed(self.turns):
                if t.generation_id == generation_id and t.role == TurnRole.USER:
                    t.tool_executions.append(te)
                    break
            return te

    def update_rime_config(self, model: str, voice: str, language: str):
        self.model = model
        self.voice = voice
        self.language = language

    def get_context_summary(self) -> List[Dict]:
        """Return recent conversation history for LLM context."""
        history = []
        for t in self.turns[-10:]:  # last 10 turns
            if t.role in (TurnRole.USER, TurnRole.ASSISTANT):
                entry = {"role": t.role.value, "content": t.text}
                if t.interrupted and t.heard_boundary is not None:
                    entry["content"] = t.text[: t.heard_boundary]
                    entry["interrupted"] = True
                history.append(entry)
        return history

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conversation_id": self.conversation_id,
            "status": self.status.value,
            "current_turn_id": self.current_turn_id,
            "current_generation_id": self.current_generation_id,
            "total_turns": self.total_turns,
            "total_interruptions": self.total_interruptions,
            "total_stale_rejections": self.total_stale_rejections,
            "provider": self.provider,
            "model": self.model,
            "voice": self.voice,
            "language": self.language,
        }
