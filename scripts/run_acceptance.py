#!/usr/bin/env python3
"""
VoicePilot AI — Standalone Acceptance Test Runner CLI

Executes the automated generation fencing and barge-in proof scenario,
verifying:
1. Audio playback cutoff within 120ms
2. Generation ID increment
3. Stale chunk rejection
4. Tool cancellation
5. Semantic turn continuity
"""
import asyncio
import json
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.evaluation.acceptance import run_acceptance_test
from app.realtime.session import VoiceSession


async def main():
    print("=" * 65)
    print("  VOICEPILOT AI — REPRODUCIBLE ACCEPTANCE TEST SUITE")
    print("  Testing: Rime TTS Interruption & Generation Fencing")
    print("=" * 65)

    class MockWS:
        async def send_text(self, data):
            pass

    session = VoiceSession(MockWS(), "acceptance-cli-session")
    result = await run_acceptance_test(session)

    print("\nTest Run ID:", result.get("test_id"))
    print("-" * 65)

    for idx, step in enumerate(result.get("steps", []), 1):
        status = "PASS" if step.get("passed") else "FAIL"
        name = step.get("name")
        detail = step.get("detail", "")
        print(f"[{status}] Step {idx}: {name}")
        print(f"       Detail: {detail}")
        if step.get("measured"):
            print(f"       Measured: {step.get('measured')}")
        print()

    print("=" * 65)
    passed = result.get("passed", False)
    summary = result.get("summary", {})
    print(f"OVERALL STATUS: {'PASS' if passed else 'FAIL'}")
    print(f"Steps Passed: {summary.get('passed_steps', 0)} / {summary.get('total_steps', 0)}")
    print(f"Stale Rejections Fenced: {result.get('stale_rejections_observed', 0)}")
    print(f"Generation Chain: {' -> '.join(result.get('generation_ids', []))}")
    print("=" * 65)

    # Export report to file
    out_file = os.path.join(os.path.dirname(__file__), "..", "acceptance_evidence.json")
    with open(out_file, "w") as f:
        json.dump(result, f, indent=2)
    print(f"Evidence artifact exported to: {os.path.abspath(out_file)}\n")

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    asyncio.run(main())
