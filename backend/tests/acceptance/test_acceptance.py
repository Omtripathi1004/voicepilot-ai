"""
VoicePilot AI — Acceptance Test Suite

Runs the full interruption + generation fencing + stale result rejection scenario.
"""
import asyncio
import json
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from app.state.conversation_state import ConversationState
from app.tools.registry import get_tool_registry, ToolResult
from app.agent.orchestrator import LocalAgent


class MockWebSocket:
    """Mock WebSocket for testing session behavior."""
    def __init__(self):
        self.sent_messages = []

    async def send_text(self, text: str):
        self.sent_messages.append(json.loads(text))

    def get_messages_by_type(self, msg_type: str):
        return [m for m in self.sent_messages if m.get("type") == msg_type]


class MockSession:
    """Minimal mock session for acceptance test runner."""
    def __init__(self):
        self.session_id = "acceptance-test-001"
        self.state = ConversationState("acceptance-test-001")
        self.registry = get_tool_registry()
        self.agent = LocalAgent(self.registry)
        self._audio_cancel = None
        self.ws = MockWebSocket()

    async def _process_turn(self, text, generation_id, was_interrupted):
        """Minimal process_turn for testing."""
        from app.metrics.collector import MetricsCollector
        metrics = MetricsCollector("acceptance-test")

        response = await self.agent.process(
            user_text=text,
            generation_id=generation_id,
            conversation_history=self.state.get_context_summary(),
            is_generation_current=self.state.is_current_generation,
            cancel_event=asyncio.Event(),
        )
        return response


@pytest.fixture
async def session():
    return MockSession()


class TestAcceptanceScenario:
    """
    Full acceptance test: interrupt during tool execution,
    change request, verify stale rejection.
    """

    @pytest.mark.asyncio
    async def test_full_interruption_scenario(self, session):
        """
        Step 1: Start a turn with test_delay tool
        Step 2: Interrupt before tool completes
        Step 3: Submit new request
        Step 4: Verify stale result rejected
        Step 5: Verify new response is correct
        """
        # Step 1: Start initial turn
        initial_turn = await session.state.start_turn("test delay 10")
        initial_gen = initial_turn.generation_id

        assert session.state.is_current_generation(initial_gen)

        # Start the slow tool in background
        tool_task = asyncio.create_task(
            session.registry.execute(
                "test_delay",
                {"delay_seconds": 10, "result_value": "SHOULD_NOT_BE_SPOKEN"},
                cancel_event=asyncio.Event(),
            )
        )

        # Step 2: Interrupt after short delay
        await asyncio.sleep(0.2)
        new_gen = await session.state.interrupt()

        assert new_gen != initial_gen
        assert not session.state.is_current_generation(initial_gen)
        assert session.state.is_current_generation(new_gen)

        # Step 3: New request
        revised_turn = await session.state.start_turn("calculate 6 times 7")
        revised_gen = revised_turn.generation_id

        # Step 4: Tool completes (stale) — verify rejection
        # Cancel the task (simulates background cancellation)
        tool_task.cancel()
        try:
            await tool_task
        except (asyncio.CancelledError, Exception):
            pass

        # Stale result check
        is_stale = session.state.reject_stale(initial_gen, "tool_test_delay")
        assert is_stale is True, (
            "ACCEPTANCE FAIL: Stale tool result not detected. "
            "It would have been spoken as current output!"
        )

        # Step 5: Process revised request
        response = await session.agent.process(
            user_text="calculate 6 times 7",
            generation_id=revised_gen,
            conversation_history=session.state.get_context_summary(),
            is_generation_current=session.state.is_current_generation,
            cancel_event=asyncio.Event(),
        )

        assert not response.is_stale
        assert "42" in response.text or "42" in str(response.tool_result)

    @pytest.mark.asyncio
    async def test_generation_id_increments_on_interrupt(self, session):
        gen_ids = set()
        gen_ids.add(session.state.current_generation_id)

        for _ in range(3):
            await session.state.start_turn("test")
            new_gen = await session.state.interrupt()
            gen_ids.add(new_gen)

        # All generation IDs must be unique
        assert len(gen_ids) == 4

    @pytest.mark.asyncio
    async def test_stale_result_cannot_enter_conversation(self, session):
        """Prove stale text cannot be added to conversation."""
        await session.state.start_turn("initial request")
        old_gen = session.state.current_generation_id

        # Interrupt
        await session.state.interrupt()

        # Try to add stale assistant turn — must be rejected
        stale_result = await session.state.add_assistant_turn(
            "STALE: This must never reach the user", old_gen
        )
        assert stale_result is None, "CRITICAL: Stale result entered conversation!"

        # Verify it's not in turns
        assistant_turns = [
            t for t in session.state.turns
            if t.role.value == "assistant"
        ]
        assert len(assistant_turns) == 0

    @pytest.mark.asyncio
    async def test_tool_cancel_event_prevents_completion(self, session):
        """Verify tool cancel event stops tool execution mid-run."""
        await session.state.start_turn("test delay 5")

        cancel = asyncio.Event()

        async def run_and_cancel():
            tool_task = asyncio.create_task(
                session.registry.execute(
                    "test_delay",
                    {"delay_seconds": 5},
                    cancel_event=cancel,
                )
            )
            await asyncio.sleep(0.2)
            cancel.set()  # Cancel after 200ms
            return await tool_task

        result = await asyncio.wait_for(run_and_cancel(), timeout=3.0)
        assert result.cancelled is True


class TestStaleResultProof:
    """
    Definitive tests proving stale results cannot reach playback.
    These tests MUST fail loudly if the guard is missing.
    """

    @pytest.mark.asyncio
    async def test_obsolete_tool_result_rejected_with_message(self, session):
        """
        Intentionally return an obsolete tool result after interruption.
        The test fails with a clear message if the result is not rejected.
        """
        await session.state.start_turn("slow operation")
        stale_gen = session.state.current_generation_id

        # Interrupt
        await session.state.interrupt()
        current_gen = session.state.current_generation_id

        # Simulate obsolete tool returning result
        stale_result = ToolResult(
            tool_name="test_delay",
            result={"spoken": "OBSOLETE RESULT - MUST NOT BE SPOKEN"},
        )

        is_stale = session.state.reject_stale(stale_gen, "test_delay")

        assert is_stale is True, (
            f"\n{'='*60}\n"
            f"ACCEPTANCE TEST FAILURE: STALE RESULT GUARD NOT WORKING\n"
            f"{'='*60}\n"
            f"Stale generation: {stale_gen}\n"
            f"Current generation: {current_gen}\n"
            f"Stale result text: {stale_result.result['spoken']}\n"
            f"This result WOULD have been spoken as current output!\n"
            f"{'='*60}"
        )

    @pytest.mark.asyncio
    async def test_interruption_counter_tracks_events(self, session):
        """Verify interruption counter is accurate."""
        for i in range(5):
            await session.state.start_turn(f"turn {i}")
            await session.state.interrupt()

        assert session.state.total_interruptions == 5

    @pytest.mark.asyncio
    async def test_stale_rejection_counter_tracks_events(self, session):
        """Verify stale rejection counter is accurate."""
        await session.state.start_turn("test")
        old_gen = session.state.current_generation_id
        await session.state.interrupt()

        for source in ["tts", "tool", "agent", "audio"]:
            session.state.reject_stale(old_gen, source)

        assert session.state.total_stale_rejections == 4
