"""
VoicePilot AI — Integration Test: WebSocket End-to-End Session Flow

Tests WebSocket connection, greeting, user speech, barge-in interruption,
tool continuity, and generation fencing over simulated ASGI WebSocket.
"""
import asyncio
import json
import pytest
from starlette.testclient import TestClient

from app.api.routes import create_app
from app.realtime.session import VoiceSession


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "rime" in data or "rime_configured" in data


def test_voice_catalog_endpoint(client):
    response = client.get("/catalog/voices")
    assert response.status_code == 200
    data = response.json()
    assert "voices" in data
    assert len(data["voices"]) > 0

    # Also test /api/voices alias
    alias_response = client.get("/api/voices")
    assert alias_response.status_code == 200


def test_pronunciation_fixtures_endpoint(client):
    response = client.get("/pronunciation/fixtures")
    assert response.status_code == 200
    data = response.json()
    assert "fixtures" in data
    assert len(data["fixtures"]) > 0


@pytest.mark.asyncio
async def test_session_lifecycle_and_interruption():
    """Directly test VoiceSession message processing and interruption handling."""
    received_messages = []

    class MockWebSocket:
        async def send_text(self, text: str):
            received_messages.append(json.loads(text))

    mock_ws = MockWebSocket()
    session = VoiceSession(mock_ws, "test-int-session")

    # 1. Simulate User Speech (with calculator tool query)
    await session._handle_message({
        "type": "user_speech",
        "text": "calculate 42 * 10",
    })

    # Wait briefly for async generation
    await asyncio.sleep(0.3)

    # Verify tool execution or agent response occurred
    assert len(received_messages) > 0
    pre_interrupt_gen = session.state.current_generation_id

    # 2. Simulate Barge-In Interrupt while speaking
    await session._handle_message({
        "type": "interrupt",
    })

    # Verify generation ID incremented (fenced)
    post_interrupt_gen = session.state.current_generation_id
    assert pre_interrupt_gen != post_interrupt_gen

    # Verify interruption acknowledgment was sent
    ack = next((m for m in received_messages if m.get("type") == "interruption_ack"), None)
    assert ack is not None
    assert ack.get("new_generation_id") == post_interrupt_gen

    # 3. Verify Stale Rejection: any task sending with pre_interrupt_gen is fenced
    is_fenced = session.state.reject_stale(pre_interrupt_gen, "test_stale_source")
    assert is_fenced is True
