"""
Extra checks for /api/chat (injection, spam) + rate limit state.
Pydantic handles length; this layer adds heuristics.
"""
import os
import re
import time
from collections import defaultdict
from dataclasses import dataclass, field

from .advisory_models import ChatRequest

__all__ = [
    "allow_chat_request",
    "validate_injection_policy",
    "max_output_tokens",
]


# --- Rate limiting (in-process; add Redis for multi-replica) ---


@dataclass
class _Window:
    times: list[float] = field(default_factory=list)

    def prune(self, cutoff: float) -> None:
        self.times = [t for t in self.times if t > cutoff]

    def count(self) -> int:
        return len(self.times)

    def add(self, t: float) -> None:
        self.times.append(t)


_rpm_state: dict[str, _Window] = defaultdict(_Window)


def _get_rpm() -> int:
    return max(1, min(120, int(os.environ.get("CHAT_RPM", "12"))))


def _window_sec() -> int:
    return 60


def allow_chat_request(key: str) -> bool:
    """Sliding window: max N requests per minute per key (user id or ip)."""
    now = time.time()
    w = _rpm_state[key]
    cutoff = now - _window_sec()
    w.prune(cutoff)
    limit = _get_rpm()
    if w.count() >= limit:
        return False
    w.add(now)
    return True


# --- Content / injection heuristics (after Pydantic) ---

_INJECTION = re.compile(
    r"ignore (all|any|previous) (instruction|message|system)|"
    r"disregard your|system prompt|"
    r"\bjailbreak\b|"
    r"reveal (your |the )?(api|internal|key|token|password|secret|env)|"
    r"what (is|'s) in your (env|system)|"
    r"print your instructions|"
    r"new instructions?:|"
    r"\bDAN mode\b|"
    r"developer mode",
    re.I,
)

_NOISE = re.compile(r"[\U0001f300-\U0001f9ff]{50,}|[\0-\x08\x0b\x0c\x0e-\x1f]")


def validate_injection_policy(req: ChatRequest) -> str | None:
    """Return error code or None if OK."""
    for m in req.messages:
        if m.role != "user":
            continue
        s = m.content
        if _INJECTION.search(s):
            return "manipulation"
        if _NOISE.search(s):
            return "content_policy"
    return None


def max_output_tokens() -> int:
    return max(256, min(2048, int(os.environ.get("CHAT_MAX_OUTPUT_TOKENS", "1024"))))
