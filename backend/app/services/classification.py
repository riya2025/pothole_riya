"""
Groq-based issue classification (image vision + text fallback).
"""
import base64
import json
import re
import httpx
from app.config import settings

VALID_TYPES = {"pothole", "garbage", "streetlight", "other"}
GROQ_TEXT_MODEL = "llama-3.1-8b-instant"
GROQ_VISION_MODEL = "llama-3.2-11b-vision-preview"

TEXT_SYSTEM_PROMPT = """You classify civic issue reports into exactly one category.
Reply with JSON only, no other text: {"category":"<name>"}
<name> must be exactly one of: pothole, garbage, streetlight, other

Examples:
"garabage near home" -> {"category":"garbage"}
"big pothole on road" -> {"category":"pothole"}
"street light not working" -> {"category":"streetlight"}"""

VISION_USER_PROMPT = """Look at this photo of a civic issue and classify it into exactly one category.
Reply with JSON only, no other text: {"category":"<name>"}
<name> must be exactly one of: pothole, garbage, streetlight, other

pothole = road damage, holes, cracks in pavement
garbage = trash, waste, litter, overflowing bins, dumping
streetlight = broken street lamps, dark areas from failed lighting
other = anything else"""


def _guess_mime(image_filename: str | None) -> str:
    if not image_filename:
        return "image/jpeg"
    ext = image_filename.rsplit(".", 1)[-1].lower()
    return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
        "gif": "image/gif",
    }.get(ext, "image/jpeg")


def _parse_groq_category(raw: str) -> str | None:
    """Extract a valid category from Groq output."""
    text = (raw or "").strip()
    if not text:
        return None

    try:
        data = json.loads(text)
        if isinstance(data, dict):
            cat = str(data.get("category", "")).strip().lower()
            if cat in VALID_TYPES:
                return cat
    except json.JSONDecodeError:
        pass

    lowered = text.lower()
    if lowered in VALID_TYPES:
        return lowered

    for cat in ("streetlight", "pothole", "garbage", "other"):
        if re.search(rf"\b{re.escape(cat)}\b", lowered):
            return cat

    return None


async def _groq_chat(payload: dict) -> str | None:
    if not settings.GROQ_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
    except Exception:
        return None


async def _classify_from_image(
    description: str,
    image_bytes: bytes,
    image_mime: str,
) -> str | None:
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    data_url = f"data:{image_mime};base64,{b64}"
    desc_bit = (description or "").strip()
    text_prompt = VISION_USER_PROMPT
    if desc_bit:
        text_prompt += f'\n\nReporter also wrote: "{desc_bit}"'

    raw = await _groq_chat({
        "model": GROQ_VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": text_prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "max_tokens": 32,
        "temperature": 0,
        "response_format": {"type": "json_object"},
    })
    return _parse_groq_category(raw or "")


async def _classify_from_text(description: str) -> str | None:
    raw = await _groq_chat({
        "model": GROQ_TEXT_MODEL,
        "messages": [
            {"role": "system", "content": TEXT_SYSTEM_PROMPT},
            {"role": "user", "content": description or "unspecified issue"},
        ],
        "max_tokens": 24,
        "temperature": 0,
        "response_format": {"type": "json_object"},
    })
    return _parse_groq_category(raw or "")


async def classify_issue(
    description: str,
    image_bytes: bytes | None = None,
    image_filename: str | None = None,
) -> tuple[str, str]:
    """
    Classify issue type. Prefers Groq vision on uploaded photo, then text, then keywords.
    Returns (category, source) where source is groq_vision | groq | keywords.
    """
    if image_bytes and settings.GROQ_API_KEY:
        mime = _guess_mime(image_filename)
        category = await _classify_from_image(description, image_bytes, mime)
        if category:
            return category, "groq_vision"

    if settings.GROQ_API_KEY:
        category = await _classify_from_text(description)
        if category:
            return category, "groq"

    return _keyword_classify(description), "keywords"


async def groq_status() -> dict:
    """Check Groq text + vision model configuration."""
    sample = "garabage overloaded near my home"
    base = {
        "text_model": GROQ_TEXT_MODEL,
        "vision_model": GROQ_VISION_MODEL,
        "sample_input": sample,
    }
    if not settings.GROQ_API_KEY:
        return {
            **base,
            "configured": False,
            "working": False,
        }

    category, source = await classify_issue(sample)
    return {
        **base,
        "configured": True,
        "working": True,
        "sample_classification": category,
        "classification_source": source,
        "groq_active": source in ("groq", "groq_vision"),
        "vision_enabled": True,
    }


def _keyword_classify(description: str) -> str:
    """Keyword fallback when Groq is unavailable."""
    text = (description or "").lower()
    if any(w in text for w in ["pothole", "hole", "road", "crack", "pit"]):
        return "pothole"
    if any(
        w in text
        for w in [
            "garbage", "garabage", "gabage", "garbge", "trash", "waste",
            "litter", "dump", "rubbish", "bin", "overflow",
        ]
    ):
        return "garbage"
    if any(w in text for w in ["light", "street light", "lamp", "dark", "streetlight"]):
        return "streetlight"
    return "other"
