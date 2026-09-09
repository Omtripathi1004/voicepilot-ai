"""
VoicePilot AI — Agent Orchestrator

Local rule-based agent that orchestrates tool use and generates spoken responses.
No external LLM API required for basic operation.
Optional: OpenAI/Anthropic adapters for richer responses (configure via env).
"""
from __future__ import annotations

import asyncio
import re
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

import structlog

from app.security.config import get_settings
from app.tts.speech_writer import prepare_for_speech
from app.tools.registry import ToolRegistry

logger = structlog.get_logger(__name__)


class AgentResponse:
    def __init__(
        self,
        text: str,
        tool_name: Optional[str] = None,
        tool_args: Optional[Dict] = None,
        tool_result: Optional[Any] = None,
        generation_id: str = "",
        is_stale: bool = False,
    ):
        self.text = text
        self.tool_name = tool_name
        self.tool_args = tool_args
        self.tool_result = tool_result
        self.generation_id = generation_id
        self.is_stale = is_stale
        self.speech_text = prepare_for_speech(text)


def _extract_tool_intent(user_text: str) -> Optional[Tuple[str, Dict]]:
    """
    Simple intent/entity extraction to map natural language to tools.
    Returns (tool_name, args) or None.
    """
    lower = user_text.lower()

    # Calculator
    calc_patterns = [
        r"(?:calculate|compute|what is|solve|eval)\s+(.+)",
        r"(\d[\d\s\+\-\*\/\(\)\.\^]+\d)",
    ]
    for pattern in calc_patterns:
        m = re.search(pattern, lower)
        if m:
            raw_expr = m.group(1).strip()
            expr = (
                raw_expr.replace("times", "*")
                .replace("multiplied by", "*")
                .replace("plus", "+")
                .replace("minus", "-")
                .replace("divided by", "/")
                .replace("x", "*")
            )
            if any(op in expr for op in ["+", "-", "*", "/", "^", "sqrt"]):
                return ("calculator", {"expression": expr})

    # Timer
    timer_patterns = [
        r"(?:set|start|create)\s+(?:a\s+)?timer\s+(?:for\s+)?(\d+)\s*(second|minute|hour)",
        r"remind\s+me\s+in\s+(\d+)\s*(second|minute|hour)",
    ]
    for pattern in timer_patterns:
        m = re.search(pattern, lower)
        if m:
            amount = int(m.group(1))
            unit = m.group(2)
            seconds = amount * (60 if "minute" in unit else 3600 if "hour" in unit else 1)
            return ("timer", {"duration_seconds": seconds, "label": "user timer"})

    # Task management
    if any(w in lower for w in ["add task", "create task", "new task", "todo"]):
        task_m = re.search(r"(?:task|todo)\s*:?\s*(.+)", lower)
        title = task_m.group(1) if task_m else "New task"
        return ("task_manager", {"action": "create", "title": title})

    if any(w in lower for w in ["list tasks", "show tasks", "my tasks", "what tasks"]):
        return ("task_manager", {"action": "list"})

    # Knowledge
    knowledge_triggers = ["what is", "tell me about", "explain", "how does", "what are"]
    for trigger in knowledge_triggers:
        if trigger in lower:
            topic = lower.split(trigger, 1)[-1].strip().rstrip("?.")
            return ("knowledge", {"query": topic})

    # Test delay (for acceptance testing)
    delay_m = re.search(r"(?:test\s+delay|simulate\s+delay)\s+(\d+)", lower)
    if delay_m:
        delay = int(delay_m.group(1))
        return ("test_delay", {"delay_seconds": delay, "result_value": "acceptance-test-result"})

    return None


RESPONSE_TEMPLATES = {
    "greeting": [
        "Hello! I'm VoicePilot, your voice-native AI agent. You can ask me to calculate, set timers, manage tasks, or just chat. What can I help you with?",
        "Hi there! I'm VoicePilot. I can calculate things, set timers, manage your tasks, or answer questions. What would you like to do?",
    ],
    "farewell": [
        "Goodbye! It was great talking with you.",
        "See you next time. Take care!",
    ],
    "thanks": [
        "You're welcome! Anything else I can help with?",
        "Happy to help! Is there anything else?",
    ],
    "unclear": [
        "I'm not sure I understood that. You can ask me to calculate something, set a timer, manage tasks, or look up information about VoicePilot AI.",
        "Could you rephrase that? I can help with calculations, timers, task management, or information lookups.",
    ],
    "interrupted_ack": [
        "Got it. What would you like to do?",
        "Sure, what's the updated request?",
        "Okay, I heard you. What would you like instead?",
    ],
}


def _simple_response(user_text: str, was_interrupted: bool = False) -> str:
    """Generate a simple spoken response for non-tool input."""
    lower = user_text.lower().strip()

    if was_interrupted:
        return RESPONSE_TEMPLATES["interrupted_ack"][0]

    if any(w in lower for w in ["hello", "hi", "hey", "good morning", "good afternoon"]):
        return RESPONSE_TEMPLATES["greeting"][0]

    if any(w in lower for w in ["bye", "goodbye", "see you", "farewell"]):
        return RESPONSE_TEMPLATES["farewell"][0]

    if any(w in lower for w in ["thank", "thanks", "appreciate"]):
        return RESPONSE_TEMPLATES["thanks"][0]

    if any(w in lower for w in ["how are you", "how's it going", "what's up"]):
        return "I'm running well and ready to help! What can I do for you today?"

    if "demo" in lower or "test" in lower:
        return "Sure! Let me demonstrate my capabilities. I'll start a test operation. You can interrupt me at any time by speaking or clicking the interrupt button."

    if any(w in lower for w in ["help", "what can you do", "capabilities"]):
        return "I can calculate math expressions, set countdown timers, manage your task list, and look up information about VoicePilot AI. Just tell me what you need!"

    if any(w in lower for w in ["interrupt", "stop", "cancel"]):
        return "I've noted your request. What would you like to do instead?"

    return RESPONSE_TEMPLATES["unclear"][0]


class LocalAgent:
    """
    Local rule-based agent orchestrator.
    Handles intent detection, tool dispatch, and response generation.
    No external API required.
    """

    def __init__(self, tool_registry: ToolRegistry):
        self.registry = tool_registry

    async def process(
        self,
        user_text: str,
        generation_id: str,
        conversation_history: List[Dict],
        is_generation_current: Callable[[str], bool],
        on_tool_start: Optional[Callable] = None,
        on_tool_complete: Optional[Callable] = None,
        cancel_event: Optional[asyncio.Event] = None,
        was_interrupted: bool = False,
    ) -> AgentResponse:
        """
        Process user input and produce an AgentResponse.
        Checks generation_id before returning any result.
        """
        reasoning_start = time.time()

        # Check if still current before even starting
        if not is_generation_current(generation_id):
            return AgentResponse(
                text="", generation_id=generation_id, is_stale=True
            )

        # Detect tool intent
        tool_intent = _extract_tool_intent(user_text)

        reasoning_end = time.time()
        logger.info(
            "agent_reasoning",
            has_tool=tool_intent is not None,
            duration_ms=(reasoning_end - reasoning_start) * 1000,
        )

        if tool_intent:
            tool_name, tool_args = tool_intent

            # Pre-announce tool execution
            if on_tool_start:
                await on_tool_start(tool_name, tool_args)

            # Check generation before tool execution
            if not is_generation_current(generation_id):
                return AgentResponse(
                    text="", generation_id=generation_id, is_stale=True
                )

            # Create cancel event for tool
            tool_cancel = cancel_event or asyncio.Event()

            # Execute tool
            tool_result = await self.registry.execute(
                tool_name, tool_args, cancel_event=tool_cancel
            )

            if on_tool_complete:
                await on_tool_complete(tool_name, tool_result)

            # CRITICAL: Check generation_id after tool completes
            if not is_generation_current(generation_id):
                logger.warning(
                    "stale_tool_result_rejected",
                    tool=tool_name,
                    generation_id=generation_id,
                )
                return AgentResponse(
                    text="",
                    tool_name=tool_name,
                    tool_result=tool_result,
                    generation_id=generation_id,
                    is_stale=True,
                )

            if tool_result.cancelled:
                return AgentResponse(
                    text="The operation was cancelled.",
                    tool_name=tool_name,
                    tool_args=tool_args,
                    generation_id=generation_id,
                )

            if tool_result.error:
                return AgentResponse(
                    text=f"I encountered an error: {tool_result.error}",
                    tool_name=tool_name,
                    tool_args=tool_args,
                    generation_id=generation_id,
                )

            # Build spoken response from tool result
            spoken = (
                tool_result.result.get("spoken", str(tool_result.result))
                if isinstance(tool_result.result, dict)
                else str(tool_result.result)
            )
            return AgentResponse(
                text=spoken,
                tool_name=tool_name,
                tool_args=tool_args,
                tool_result=tool_result.result,
                generation_id=generation_id,
            )

        # No tool — generate spoken response
        response_text = _simple_response(user_text, was_interrupted=was_interrupted)
        return AgentResponse(
            text=response_text,
            generation_id=generation_id,
        )
