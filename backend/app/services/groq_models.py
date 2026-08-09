"""
Auto-detect which Groq models the configured API key can use.
"""
from __future__ import annotations

import time
from typing import Iterable

import httpx

from app.config import settings

# Preferred vision models, in order. First match available on the key wins.
VISION_MODEL_CANDIDATES = (
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "qwen/qwen3.6-27b",  # multimodal on current Groq free tier for many keys
)

TEXT_MODEL_CANDIDATES = (
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "qwen/qwen3.6-27b",
    "openai/gpt-oss-20b",
)

_cache: dict = {"at": 0.0, "ids": set(), "vision": None, "text": None}
_CACHE_TTL_S = 300.0


async def list_model_ids() -> set[str]:
    if not settings.GROQ_API_KEY:
        return set()
    now = time.time()
    if _cache["ids"] and now - _cache["at"] < _CACHE_TTL_S:
        return _cache["ids"]
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            )
            if resp.status_code >= 400:
                print(f"[groq] list models HTTP {resp.status_code}: {resp.text[:200]}")
                return set(_cache["ids"] or set())
            ids = {m.get("id") for m in resp.json().get("data", []) if m.get("id")}
            _cache["ids"] = ids
            _cache["at"] = now
            return ids
    except Exception as exc:
        print(f"[groq] list models failed: {exc}")
        return set(_cache["ids"] or set())


def _first_available(candidates: Iterable[str], available: set[str], fallback: str) -> str:
    for model in candidates:
        if model in available:
            return model
    return fallback


async def resolve_vision_model() -> str | None:
    """
    Return a vision-capable model id available to this API key, or None.
    Honors GROQ_VISION_MODEL when that model is listed for the key.
    """
    configured = (settings.GROQ_VISION_MODEL or "").strip()
    available = await list_model_ids()
    if not available:
        # Network blip — keep configured preference if set
        return configured or None

    if configured and configured in available:
        _cache["vision"] = configured
        return configured

    # Configured model missing on this key — auto-pick
    picked = None
    for model in VISION_MODEL_CANDIDATES:
        if model in available:
            picked = model
            break
    _cache["vision"] = picked
    if configured and configured != picked:
        print(
            f"[groq] vision model '{configured}' not on this API key; "
            f"auto-using '{picked}'"
        )
    return picked


async def resolve_text_model() -> str:
    configured = (settings.GROQ_TEXT_MODEL or "").strip()
    available = await list_model_ids()
    if configured and (not available or configured in available):
        _cache["text"] = configured
        return configured
    picked = _first_available(TEXT_MODEL_CANDIDATES, available, "llama-3.1-8b-instant")
    _cache["text"] = picked
    return picked


def vision_model_supports_json_mode(model: str | None) -> bool:
    """Qwen on Groq often fails json_object mode on vision prompts."""
    if not model:
        return False
    return not model.startswith("qwen/")
