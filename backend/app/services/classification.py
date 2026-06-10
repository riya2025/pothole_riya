"""
Groq-based issue classification service.
Input: user description text
Output: (category, source) where source is "groq" or "keywords"
"""
import json
import re
import httpx
from app.config import settings

VALID_TYPES = {"pothole", "garbage", "streetlight", "other"}
GROQ_MODEL = "llama-3.1-8b-instant"

SYSTEM_PROMPT = """You classify civic issue reports into exactly one category.
Reply with JSON only, no other text: {"category":"<name>"}
<name> must be exactly one of: pothole, garbage, streetlight, other

Examples:
"garabage near home" -> {"category":"garbage"}
"big pothole on road" -> {"category":"pothole"}
"street light not working" -> {"category":"streetlight"}"""


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


async def classify_issue(description: str) -> tuple[str, str]:
    """Classify issue type. Returns (category, 'groq' | 'keywords')."""
    if not settings.GROQ_API_KEY:
        return _keyword_classify(description), "keywords"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": description or "unspecified issue"},
                    ],
                    "max_tokens": 24,
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                },
            )
            response.raise_for_status()
            result = response.json()
            raw = result["choices"][0]["message"]["content"]
            category = _parse_groq_category(raw)
            if category:
                return category, "groq"
    except Exception:
        pass

    return _keyword_classify(description), "keywords"


async def groq_status() -> dict:
    """Check Groq setup using the same classifier as real reports."""
    sample = "garabage overloaded near my home"
    if not settings.GROQ_API_KEY:
        return {
            "configured": False,
            "working": False,
            "model": GROQ_MODEL,
            "sample_input": sample,
        }

    category, source = await classify_issue(sample)
    return {
        "configured": True,
        "working": True,
        "model": GROQ_MODEL,
        "sample_input": sample,
        "sample_classification": category,
        "classification_source": source,
        "groq_active": source == "groq",
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
