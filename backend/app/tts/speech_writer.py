"""
VoicePilot AI — Speech Writer (Writing for the Ear)

Post-processes text before TTS to optimize for listening comprehension.
Short sentences. Natural punctuation. No excessive symbols.
"""
from __future__ import annotations

import re
from typing import List


def prepare_for_speech(text: str) -> str:
    """
    Transform text for optimal TTS delivery.
    - Expand abbreviations
    - Normalize numbers/codes for natural speech
    - Remove excessive symbols
    - Ensure short sentences with pauses
    """
    text = _expand_abbreviations(text)
    text = _normalize_numbers(text)
    text = _remove_excessive_symbols(text)
    text = _ensure_sentence_pauses(text)
    text = _clean_whitespace(text)
    return text


def _expand_abbreviations(text: str) -> str:
    abbrevs = {
        r"\bAPI\b": "A P I",
        r"\bUI\b": "U I",
        r"\bUX\b": "U X",
        r"\bURL\b": "U R L",
        r"\bHTTP\b": "H T T P",
        r"\bHTTPS\b": "H T T P S",
        r"\bSTT\b": "S T T",
        r"\bTTS\b": "T T S",
        r"\bAI\b": "A I",
        r"\bLLM\b": "L L M",
        r"\bID\b": "I D",
        r"\bOK\b": "okay",
        r"\bOk\b": "okay",
        r"\betc\.\b": "etcetera",
        r"\be\.g\.\b": "for example",
        r"\bi\.e\.\b": "that is",
    }
    for pattern, replacement in abbrevs.items():
        text = re.sub(pattern, replacement, text)
    return text


def _normalize_numbers(text: str) -> str:
    # Expand decimal numbers
    text = re.sub(r"\b(\d+)\.(\d+)\b", lambda m: f"{m.group(1)} point {m.group(2)}", text)
    # Large numbers with commas
    text = text.replace(",", "")
    return text


def _remove_excessive_symbols(text: str) -> str:
    # Remove markdown formatting
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"__(.+?)__", r"\1", text)
    text = re.sub(r"`(.+?)`", r"\1", text)
    text = re.sub(r"#{1,6}\s+", "", text)
    # Remove excessive punctuation
    text = re.sub(r"[!]{2,}", "!", text)
    text = re.sub(r"[.]{3,}", "...", text)
    # Remove special chars that TTS handles poorly
    text = re.sub(r"[→←↑↓►◄]", "", text)
    text = re.sub(r"[★☆♦♣♠♥]", "", text)
    return text


def _ensure_sentence_pauses(text: str) -> str:
    """Break long run-on sentences into shorter ones for natural pacing."""
    # Convert semicolons to periods for spoken flow
    text = text.replace(";", ".")
    # Ensure space after punctuation
    text = re.sub(r"([.!?])([A-Z])", r"\1 \2", text)
    return text


def _clean_whitespace(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def chunk_for_streaming(text: str, chunk_size: int = 100) -> List[str]:
    """
    Split prepared text into streaming chunks for incremental TTS.
    Breaks on sentence boundaries where possible.
    """
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks = []
    current = ""

    for sentence in sentences:
        if len(current) + len(sentence) <= chunk_size:
            current += (" " if current else "") + sentence
        else:
            if current:
                chunks.append(current)
            current = sentence

    if current:
        chunks.append(current)

    return chunks if chunks else [text]


# Pronunciation test fixtures
PRONUNCIATION_FIXTURES = [
    {
        "id": "names_01",
        "category": "Names",
        "text": "Dr. Sophia Chen and Mr. João Oliveira met in São Paulo.",
        "notes": "Foreign names, accented characters",
    },
    {
        "id": "numbers_01",
        "category": "Numbers",
        "text": "The price is $1,299.99 for the annual plan.",
        "notes": "Currency, large number, decimal",
    },
    {
        "id": "addresses_01",
        "category": "Addresses",
        "text": "Meet me at 42 Wallaby Way, Sydney, New South Wales 2000.",
        "notes": "Street address with suburb and postcode",
    },
    {
        "id": "identifiers_01",
        "category": "Identifiers",
        "text": "Your ticket number is VPA-20240912-XK47.",
        "notes": "Alphanumeric identifier with hyphens",
    },
    {
        "id": "abbreviations_01",
        "category": "Abbreviations",
        "text": "The REST API returns JSON over HTTPS with OAuth 2.0.",
        "notes": "Technical abbreviations",
    },
    {
        "id": "times_01",
        "category": "Times and Dates",
        "text": "The meeting is on Thursday, September 12th at 3:30 PM.",
        "notes": "Date and time phrasing",
    },
    {
        "id": "domain_01",
        "category": "Domain Vocabulary",
        "text": "The TTS pipeline achieved 340 milliseconds TTFA with full-duplex barge-in.",
        "notes": "Voice AI domain terms",
    },
    {
        "id": "lists_01",
        "category": "Spoken Lists",
        "text": "You have three tasks. First, review the report. Second, call the client. Third, update the dashboard.",
        "notes": "Spoken-first list structure",
    },
]
