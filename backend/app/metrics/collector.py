"""
VoicePilot AI — Metrics Collector

Collects, stores, and reports real measured metrics.
No fabricated numbers. All measurements from actual events.
"""
from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, List, Optional


@dataclass
class ObservabilityEvent:
    event_type: str
    timestamp: float = field(default_factory=time.time)
    data: Dict[str, Any] = field(default_factory=dict)
    session_id: str = ""
    turn_id: str = ""
    generation_id: str = ""

    def to_dict(self) -> Dict:
        return {
            "event_type": self.event_type,
            "timestamp": self.timestamp,
            "data": self.data,
            "session_id": self.session_id,
            "turn_id": self.turn_id,
            "generation_id": self.generation_id,
        }


class MetricsCollector:
    """
    Collects real timing metrics from actual events.
    Maintains a rolling window of events for observability.
    """

    MAX_EVENTS = 500

    def __init__(self, session_id: str):
        self.session_id = session_id
        self._events: Deque[ObservabilityEvent] = deque(maxlen=self.MAX_EVENTS)
        self._turn_metrics: Dict[str, Dict] = {}
        self._total_stale_rejections = 0
        self._total_interruptions = 0

    def emit(
        self,
        event_type: str,
        turn_id: str = "",
        generation_id: str = "",
        **data,
    ) -> ObservabilityEvent:
        ev = ObservabilityEvent(
            event_type=event_type,
            session_id=self.session_id,
            turn_id=turn_id,
            generation_id=generation_id,
            data=data,
        )
        self._events.append(ev)
        return ev

    def record_stale_rejection(self, source: str, generation_id: str):
        self._total_stale_rejections += 1
        self.emit(
            "stale_result_rejected",
            generation_id=generation_id,
            source=source,
            total_rejections=self._total_stale_rejections,
        )

    def record_interruption(self, old_gen: str, new_gen: str, turn_id: str):
        self._total_interruptions += 1
        self.emit(
            "interruption",
            turn_id=turn_id,
            generation_id=new_gen,
            old_generation_id=old_gen,
            total_interruptions=self._total_interruptions,
        )

    def get_events(self, limit: int = 100, event_type: Optional[str] = None) -> List[Dict]:
        events = list(self._events)
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        return [e.to_dict() for e in events[-limit:]]

    def get_summary(self) -> Dict:
        return {
            "session_id": self.session_id,
            "total_events": len(self._events),
            "total_stale_rejections": self._total_stale_rejections,
            "total_interruptions": self._total_interruptions,
        }

    def export_events(self) -> List[Dict]:
        """Export all events for evidence/testing."""
        return [e.to_dict() for e in self._events]
