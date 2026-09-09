"""
VoicePilot AI — Unit Tests: State Machine & Generation Fencing

Tests the core conversation state transitions and stale-result rejection.
"""
import asyncio
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from app.state.conversation_state import (
    ConversationState,
    ConversationStatus,
    TurnRole,
)


@pytest.fixture
def state():
    return ConversationState(conversation_id="test-conv-001")


class TestStateMachine:
    def test_initial_state(self, state):
        assert state.status == ConversationStatus.IDLE
        assert state.total_turns == 0
        assert state.total_interruptions == 0

    @pytest.mark.asyncio
    async def test_start_turn_transitions_to_processing(self, state):
        turn = await state.start_turn("Hello world")
        assert state.status == ConversationStatus.PROCESSING
        assert turn.role == TurnRole.USER
        assert turn.text == "Hello world"
        assert state.total_turns == 1

    @pytest.mark.asyncio
    async def test_set_status(self, state):
        await state.set_status(ConversationStatus.SPEAKING)
        assert state.status == ConversationStatus.SPEAKING

    @pytest.mark.asyncio
    async def test_interrupt_increments_generation(self, state):
        initial_gen = state.current_generation_id
        await state.start_turn("test")
        new_gen = await state.interrupt()
        assert new_gen != initial_gen
        assert state.current_generation_id == new_gen
        assert state.status == ConversationStatus.INTERRUPTED
        assert state.total_interruptions == 1

    @pytest.mark.asyncio
    async def test_multiple_interrupts(self, state):
        gen1 = state.current_generation_id
        await state.start_turn("one")
        gen2 = await state.interrupt()
        await state.start_turn("two")
        gen3 = await state.interrupt()

        assert gen1 != gen2
        assert gen2 != gen3
        assert state.total_interruptions == 2


class TestGenerationFencing:
    @pytest.mark.asyncio
    async def test_current_generation_check(self, state):
        current_gen = state.current_generation_id
        assert state.is_current_generation(current_gen) is True

    @pytest.mark.asyncio
    async def test_stale_generation_rejected(self, state):
        old_gen = state.current_generation_id
        await state.start_turn("test")
        await state.interrupt()  # increments generation_id

        # Old generation should now be stale
        assert state.is_current_generation(old_gen) is False
        is_stale = state.reject_stale(old_gen, "test_source")
        assert is_stale is True
        assert state.total_stale_rejections == 1

    @pytest.mark.asyncio
    async def test_current_generation_not_rejected(self, state):
        await state.start_turn("test")
        current_gen = state.current_generation_id

        # Current generation should not be rejected
        is_stale = state.reject_stale(current_gen, "test_source")
        assert is_stale is False
        assert state.total_stale_rejections == 0

    @pytest.mark.asyncio
    async def test_stale_assistant_turn_rejected(self, state):
        await state.start_turn("test")
        old_gen = state.current_generation_id

        # Interrupt changes generation
        await state.interrupt()

        # Adding assistant turn with old gen should be rejected
        result = await state.add_assistant_turn("This should be rejected", old_gen)
        assert result is None

    @pytest.mark.asyncio
    async def test_current_assistant_turn_accepted(self, state):
        await state.start_turn("test")
        current_gen = state.current_generation_id

        result = await state.add_assistant_turn("This should be accepted", current_gen)
        assert result is not None
        assert result.text == "This should be accepted"

    @pytest.mark.asyncio
    async def test_stale_result_counter_increments(self, state):
        await state.start_turn("test")
        old_gen = state.current_generation_id
        await state.interrupt()

        state.reject_stale(old_gen, "tool")
        state.reject_stale(old_gen, "tts")
        state.reject_stale(old_gen, "agent")

        assert state.total_stale_rejections == 3


class TestCancellation:
    @pytest.mark.asyncio
    async def test_interrupt_cancels_tts_task(self, state):
        # Create a mock TTS task
        async def fake_tts():
            await asyncio.sleep(10)

        await state.start_turn("test")
        tts_task = asyncio.create_task(fake_tts())
        state.active_tts_task = tts_task

        await state.interrupt()
        await asyncio.sleep(0.01)

        # Task should be cancelled or done
        assert tts_task.cancelled() or tts_task.done()

    @pytest.mark.asyncio
    async def test_interrupt_sets_tool_cancel_events(self, state):
        from app.state.conversation_state import ToolExecution

        await state.start_turn("test")
        gen_id = state.current_generation_id

        # Add a fake tool execution
        te = ToolExecution(
            tool_id="test-tool-id",
            tool_name="test_delay",
            args={"delay": 5},
        )
        state.turns[-1].tool_executions.append(te)

        await state.interrupt()

        # Tool cancel event should be set
        assert te.cancel_event.is_set()
        assert te.cancelled

    @pytest.mark.asyncio
    async def test_conversation_context_summary(self, state):
        await state.start_turn("What is 2 plus 2?")
        await state.add_assistant_turn("Two plus two equals four.", state.current_generation_id)
        await state.start_turn("And 3 plus 3?")

        history = state.get_context_summary()
        assert len(history) >= 2
        assert any(h["role"] == "user" for h in history)
        assert any(h["role"] == "assistant" for h in history)


class TestStaleTTSResultRejection:
    """
    Critical test: proves that a stale TTS result cannot be spoken.
    Simulates the race condition where tool finishes after interruption.
    """

    @pytest.mark.asyncio
    async def test_stale_tts_cannot_reach_playback(self, state):
        """
        Start a turn, interrupt it, then try to inject a stale result.
        The stale result MUST be rejected and never 'played'.
        """
        await state.start_turn("Run a slow operation")
        old_gen = state.current_generation_id

        # Interrupt
        new_gen = await state.interrupt()

        # Simulate: old operation completes and tries to add audio/text
        # This is the stale result that must be rejected
        stale_text = "This old result must never be spoken"
        result = await state.add_assistant_turn(stale_text, old_gen)

        # CRITICAL: result must be None (rejected)
        assert result is None, (
            f"FAILURE: Stale result was NOT rejected! "
            f"Text '{stale_text}' would have been spoken as current output."
        )

        # Verify rejection counter
        assert state.total_stale_rejections >= 1

    @pytest.mark.asyncio
    async def test_obsolete_tool_result_cannot_be_spoken(self, state):
        """
        Intentionally return an obsolete tool result after interruption
        and prove it cannot be spoken.
        """
        from app.tools.registry import ToolResult

        await state.start_turn("Do the slow test delay")
        old_gen = state.current_generation_id

        # Simulate interruption
        new_gen = await state.interrupt()

        # Simulate: obsolete tool result arrives with old generation_id
        obsolete_tool_result = ToolResult(
            tool_name="test_delay",
            result={"spoken": "OBSOLETE: This result from old turn must be silent"},
        )

        # Check: system must detect this is stale
        is_stale = state.reject_stale(old_gen, "obsolete_tool_result")
        assert is_stale is True, (
            f"CRITICAL FAILURE: Stale tool result from generation {old_gen} "
            f"was NOT detected as stale. Current generation is {new_gen}. "
            f"This result WOULD have been spoken as current output."
        )

        # Verify stale count
        assert state.total_stale_rejections >= 1
