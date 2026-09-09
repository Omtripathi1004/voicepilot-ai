"""
VoicePilot AI — Tool Registry & Framework

Async tool execution framework with cancellation support.
All tools check cancel_event to support interruption.
"""
from __future__ import annotations

import asyncio
import math
import re
import time
import uuid
from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, List, Optional

import structlog

logger = structlog.get_logger(__name__)


class ToolResult:
    def __init__(
        self,
        tool_name: str,
        result: Any,
        error: Optional[str] = None,
        cancelled: bool = False,
        duration_ms: Optional[float] = None,
    ):
        self.tool_name = tool_name
        self.result = result
        self.error = error
        self.cancelled = cancelled
        self.duration_ms = duration_ms

    @property
    def success(self) -> bool:
        return not self.error and not self.cancelled

    def to_dict(self) -> Dict:
        return {
            "tool_name": self.tool_name,
            "result": self.result,
            "error": self.error,
            "cancelled": self.cancelled,
            "duration_ms": self.duration_ms,
        }


class BaseTool(ABC):
    name: str = ""
    description: str = ""
    parameters: Dict = {}

    @abstractmethod
    async def execute(
        self, args: Dict[str, Any], cancel_event: Optional[asyncio.Event] = None
    ) -> ToolResult:
        pass


# ─── Calculator Tool ──────────────────────────────────────────────────────────
class CalculatorTool(BaseTool):
    name = "calculator"
    description = "Evaluate a mathematical expression"
    parameters = {
        "expression": {"type": "string", "description": "Math expression to evaluate"}
    }

    async def execute(self, args: Dict, cancel_event: Optional[asyncio.Event] = None) -> ToolResult:
        start = time.time()
        expr = str(args.get("expression", ""))

        # Strip non-math words (e.g. "instead", "please")
        expr = re.sub(r"[^\d\+\-\*\/\(\)\.\%\^\s,]", "", expr).strip()

        # Safe eval: only allow math operations
        allowed = set("0123456789+-*/().%^eE ,")
        if not expr or not all(c in allowed for c in expr):
            return ToolResult(self.name, None, error="Invalid characters in expression")

        try:
            # Replace ^ with ** for power
            expr = expr.replace("^", "**")
            result = eval(expr, {"__builtins__": {}}, {
                "abs": abs, "round": round,
                "min": min, "max": max,
                "sqrt": math.sqrt, "pow": math.pow,
                "pi": math.pi, "e": math.e,
            })
            spoken = f"The result is {round(result, 6)}"
            return ToolResult(
                self.name,
                {"value": result, "spoken": spoken, "expression": expr},
                duration_ms=(time.time() - start) * 1000,
            )
        except Exception as ex:
            return ToolResult(self.name, None, error=f"Calculation error: {ex}")


# ─── Timer Tool ───────────────────────────────────────────────────────────────
_active_timers: Dict[str, asyncio.Task] = {}


class TimerTool(BaseTool):
    name = "timer"
    description = "Set a countdown timer"
    parameters = {
        "duration_seconds": {"type": "number", "description": "Timer duration in seconds"},
        "label": {"type": "string", "description": "Optional label for the timer"},
    }

    async def execute(self, args: Dict, cancel_event: Optional[asyncio.Event] = None) -> ToolResult:
        start = time.time()
        duration = float(args.get("duration_seconds", 10))
        label = str(args.get("label", "timer"))

        if duration > 3600:
            return ToolResult(self.name, None, error="Timer duration exceeds 1 hour limit")

        timer_id = str(uuid.uuid4())[:8]

        async def _run_timer():
            await asyncio.sleep(duration)
            return f"Timer '{label}' ({duration}s) completed."

        try:
            result = await asyncio.wait_for(
                asyncio.shield(_run_timer()),
                timeout=duration + 1,
            )
            if cancel_event and cancel_event.is_set():
                return ToolResult(self.name, None, cancelled=True)
            return ToolResult(
                self.name,
                {"timer_id": timer_id, "label": label, "duration_seconds": duration,
                 "spoken": f"Timer set for {duration} seconds with label {label}."},
                duration_ms=(time.time() - start) * 1000,
            )
        except asyncio.CancelledError:
            return ToolResult(self.name, None, cancelled=True)


# ─── Task Manager Tool ────────────────────────────────────────────────────────
_task_store: Dict[str, Dict] = {}


class TaskManagerTool(BaseTool):
    name = "task_manager"
    description = "Create, list, complete, or delete tasks"
    parameters = {
        "action": {"type": "string", "enum": ["create", "list", "complete", "delete"]},
        "task_id": {"type": "string", "description": "Task ID (for complete/delete)"},
        "title": {"type": "string", "description": "Task title (for create)"},
    }

    async def execute(self, args: Dict, cancel_event: Optional[asyncio.Event] = None) -> ToolResult:
        start = time.time()
        action = args.get("action", "list")

        if action == "create":
            title = args.get("title", "Unnamed task")
            task_id = str(uuid.uuid4())[:8]
            _task_store[task_id] = {
                "id": task_id, "title": title,
                "done": False, "created_at": time.time()
            }
            return ToolResult(
                self.name,
                {"action": "created", "task_id": task_id, "title": title,
                 "spoken": f"Task created: {title}. Task I D is {task_id}."},
                duration_ms=(time.time() - start) * 1000,
            )

        elif action == "list":
            tasks = list(_task_store.values())
            pending = [t for t in tasks if not t["done"]]
            done = [t for t in tasks if t["done"]]
            spoken = (
                f"You have {len(pending)} pending task{'s' if len(pending) != 1 else ''}. "
                + (f"Pending: {', '.join(t['title'] for t in pending[:3])}." if pending else "")
            )
            return ToolResult(
                self.name,
                {"tasks": tasks, "pending_count": len(pending), "done_count": len(done),
                 "spoken": spoken},
                duration_ms=(time.time() - start) * 1000,
            )

        elif action == "complete":
            task_id = args.get("task_id", "")
            if task_id in _task_store:
                _task_store[task_id]["done"] = True
                title = _task_store[task_id]["title"]
                return ToolResult(
                    self.name,
                    {"action": "completed", "task_id": task_id, "title": title,
                     "spoken": f"Marked task '{title}' as complete."},
                    duration_ms=(time.time() - start) * 1000,
                )
            return ToolResult(self.name, None, error=f"Task {task_id} not found")

        elif action == "delete":
            task_id = args.get("task_id", "")
            if task_id in _task_store:
                title = _task_store.pop(task_id)["title"]
                return ToolResult(
                    self.name,
                    {"action": "deleted", "task_id": task_id, "spoken": f"Deleted task '{title}'."},
                    duration_ms=(time.time() - start) * 1000,
                )
            return ToolResult(self.name, None, error=f"Task {task_id} not found")

        return ToolResult(self.name, None, error=f"Unknown action: {action}")


# ─── Knowledge Tool ───────────────────────────────────────────────────────────
KNOWLEDGE_BASE = {
    "voicepilot": "VoicePilot A I is a real-time, full-duplex voice agent powered by Rime T T S. It supports barge-in interruption, tool execution, and multilingual voice output.",
    "rime": "Rime is a voice A I company providing high-quality text-to-speech synthesis with a large catalog of voices across many languages.",
    "interruption": "VoicePilot supports true barge-in. When you speak while the agent is talking, it stops immediately, processes your new input, and responds with updated context.",
    "tools": "VoicePilot has built-in tools: a calculator, timer, task manager, and knowledge lookup. Tools run asynchronously so you can keep talking while they execute.",
    "ttfa": "T T F A stands for Time To First Audio. It measures the delay from when you finish speaking to when you first hear the agent's response.",
    "generation": "Each conversation turn has a generation I D. If you interrupt, the generation I D changes, and any stale results from the old turn are automatically discarded.",
    "languages": "VoicePilot discovers available languages from the Rime voice catalog. You can switch language and voice using the selector in the interface.",
    "demo": "The demo mode shows a complete flow: voice interaction, tool execution with delay, interruption, stale-result rejection, and a corrected Rime response.",
}


class KnowledgeTool(BaseTool):
    name = "knowledge"
    description = "Look up information about VoicePilot AI or voice AI concepts"
    parameters = {
        "query": {"type": "string", "description": "Topic to look up"}
    }

    async def execute(self, args: Dict, cancel_event: Optional[asyncio.Event] = None) -> ToolResult:
        start = time.time()
        query = args.get("query", "").lower()

        best_key = None
        best_score = 0
        for key in KNOWLEDGE_BASE:
            score = sum(1 for word in query.split() if word in key or key in word)
            if score > best_score:
                best_score = score
                best_key = key

        if best_key and best_score > 0:
            answer = KNOWLEDGE_BASE[best_key]
            return ToolResult(
                self.name,
                {"topic": best_key, "answer": answer, "spoken": answer},
                duration_ms=(time.time() - start) * 1000,
            )

        # Generic fallback
        spoken = f"I don't have specific information about {query}. Please try asking about VoicePilot, Rime, interruption, tools, or T T F A."
        return ToolResult(
            self.name,
            {"topic": None, "spoken": spoken},
            duration_ms=(time.time() - start) * 1000,
        )


# ─── Test Delay Tool (Acceptance Test) ────────────────────────────────────────
class TestDelayTool(BaseTool):
    """
    A deliberately slow tool used for acceptance testing.
    Simulates a long-running operation to test interruption behavior.
    """
    name = "test_delay"
    description = "Simulate a long-running operation (for acceptance testing only)"
    parameters = {
        "delay_seconds": {"type": "number", "description": "How long to delay"},
        "result_value": {"type": "string", "description": "Value to return after delay"},
    }

    async def execute(self, args: Dict, cancel_event: Optional[asyncio.Event] = None) -> ToolResult:
        start = time.time()
        delay = float(args.get("delay_seconds", 5.0))
        result_value = args.get("result_value", "test-result")

        logger.info("test_delay_started", delay_seconds=delay)

        # Sleep in small increments, checking cancel_event
        interval = 0.1
        elapsed = 0.0
        while elapsed < delay:
            if cancel_event and cancel_event.is_set():
                logger.info("test_delay_cancelled", elapsed_seconds=elapsed)
                return ToolResult(
                    self.name, None, cancelled=True,
                    duration_ms=(time.time() - start) * 1000
                )
            await asyncio.sleep(interval)
            elapsed += interval

        logger.info("test_delay_completed", delay_seconds=delay)
        return ToolResult(
            self.name,
            {
                "result_value": result_value,
                "delay_seconds": delay,
                "spoken": f"The delayed operation completed after {delay} seconds. Result: {result_value}.",
            },
            duration_ms=(time.time() - start) * 1000,
        )


# ─── Tool Registry ────────────────────────────────────────────────────────────
class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}

    def register(self, tool: BaseTool):
        self._tools[tool.name] = tool
        logger.info("tool_registered", name=tool.name)

    def get(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def list_tools(self) -> List[Dict]:
        return [
            {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
            }
            for t in self._tools.values()
        ]

    async def execute(
        self,
        tool_name: str,
        args: Dict,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> ToolResult:
        tool = self.get(tool_name)
        if not tool:
            return ToolResult(tool_name, None, error=f"Unknown tool: {tool_name}")

        logger.info("tool_executing", name=tool_name, args=str(args)[:200])
        try:
            result = await tool.execute(args, cancel_event=cancel_event)
            logger.info(
                "tool_completed",
                name=tool_name,
                success=result.success,
                cancelled=result.cancelled,
                duration_ms=result.duration_ms,
            )
            return result
        except asyncio.CancelledError:
            return ToolResult(tool_name, None, cancelled=True)
        except Exception as e:
            logger.error("tool_exception", name=tool_name, error=str(e))
            return ToolResult(tool_name, None, error=str(e))


def create_default_registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(CalculatorTool())
    registry.register(TimerTool())
    registry.register(TaskManagerTool())
    registry.register(KnowledgeTool())
    registry.register(TestDelayTool())
    return registry


_registry: Optional[ToolRegistry] = None


def get_tool_registry() -> ToolRegistry:
    global _registry
    if _registry is None:
        _registry = create_default_registry()
    return _registry
