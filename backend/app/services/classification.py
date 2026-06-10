"""
Groq-based issue classification service.
Input: user description text
Output: (category, source) where source is "groq" or "keywords"
"""
import httpx
from app.config import settings

VALID_TYPES = {"pothole", "garbage", "streetlight", "other"}
GROQ_MODEL = "llama-3.1-8b-instant"

SYSTEM_PROMPT = """You are a civic issue classifier. Given a user's description of a civic issue,
classify it into exactly ONE of these categories:
- pothole
- garbage
- streetlight
- other

Handle typos (e.g. garabage = garbage). Respond with ONLY the category name, nothing else."""


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
                    "max_tokens": 10,
                    "temperature": 0,
                },
            )
            response.raise_for_status()
            result = response.json()
            category = result["choices"][0]["message"]["content"].strip().lower()
            if category in VALID_TYPES:
                return category, "groq"
    except Exception:
        pass

    return _keyword_classify(description), "keywords"


async def groq_status() -> dict:
    """Check whether Groq API key is set and the model responds."""
    if not settings.GROQ_API_KEY:
        return {"configured": False, "working": False, "model": GROQ_MODEL}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": [{"role": "user", "content": "garabage near home"}],
                    "max_tokens": 5,
                    "temperature": 0,
                },
            )
            if response.status_code != 200:
                return {
                    "configured": True,
                    "working": False,
                    "model": GROQ_MODEL,
                    "error": response.text[:200],
                }
            category = response.json()["choices"][0]["message"]["content"].strip().lower()
            return {
                "configured": True,
                "working": True,
                "model": GROQ_MODEL,
                "sample_classification": category,
            }
    except Exception as e:
        return {
            "configured": True,
            "working": False,
            "model": GROQ_MODEL,
            "error": str(e)[:200],
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
