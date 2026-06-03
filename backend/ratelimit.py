"""Lightweight in-memory, per-IP rate limiting.

Protects the shared Groq free-tier quota on the public instance from a
single visitor (or bot) hammering the expensive endpoints. Sliding-window
counters kept in memory — fine for the single-process Docker deployment.
If you run multiple workers, move this to Redis.
"""
from __future__ import annotations

import os
import threading
import time

ASK_PER_MINUTE = int(os.getenv("RATE_LIMIT_ASK_PER_MINUTE", "12"))
ASK_PER_DAY = int(os.getenv("RATE_LIMIT_ASK_PER_DAY", "200"))
UPLOAD_PER_HOUR = int(os.getenv("RATE_LIMIT_UPLOAD_PER_HOUR", "20"))

_lock = threading.Lock()
_hits: dict[str, list[float]] = {}


def _retry_after(key: str, limit: int, window: float, now: float) -> int | None:
    """Prune the window for `key` and return retry-after seconds if full.

    Does not register a new hit. Returns None when the request is allowed.
    """
    times = [t for t in _hits.get(key, []) if t > now - window]
    _hits[key] = times
    if len(times) >= limit:
        return max(1, int(window - (now - times[0])))
    return None


def _register(key: str, now: float) -> None:
    _hits.setdefault(key, []).append(now)


def hit_ask(ip: str) -> tuple[int, str] | None:
    """Account for one question from `ip`.

    Returns (retry_after_seconds, scope) if rate-limited, else None.
    """
    now = time.time()
    with _lock:
        retry = _retry_after(f"ask_min:{ip}", ASK_PER_MINUTE, 60, now)
        if retry:
            return retry, "minute"
        retry = _retry_after(f"ask_day:{ip}", ASK_PER_DAY, 86400, now)
        if retry:
            return retry, "day"
        _register(f"ask_min:{ip}", now)
        _register(f"ask_day:{ip}", now)
        return None


def hit_upload(ip: str) -> tuple[int, str] | None:
    """Account for one upload from `ip`. Returns (retry, scope) or None."""
    now = time.time()
    with _lock:
        retry = _retry_after(f"upload_hr:{ip}", UPLOAD_PER_HOUR, 3600, now)
        if retry:
            return retry, "hour"
        _register(f"upload_hr:{ip}", now)
        return None
