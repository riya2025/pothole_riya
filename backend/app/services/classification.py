"""
Groq-based issue classification service.
Input: user description text
Output: one of pothole | garbage | streetlight | other
"""
import httpx
from app.config import settings


VALID_TYPES = {"pothole", "garbage", "streetlight", "other"}

SYSTEM_PROMPT = """You are a civic issue classifier. Given a user's description of a civic issue,
classify it into exactly ONE of these categories:
- pothole
- garbage
- streetlight
- other

Respond with ONLY the category name, nothing else."""


async def classify_issue(description: str) -> str:
    """Call Groq API to classify the civic issue type. Falls back to 'other' on any error."""
    if not settings.GROQ_API_KEY:
        return _keyword_classify(description)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama3-8b-8192",
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
            return category if category in VALID_TYPES else "other"
    except Exception:
        return _keyword_classify(description)


def _keyword_classify(description: str) -> str:
    """Simple keyword-based fallback classifier."""
    text = (description or "").lower()
    if any(w in text for w in ["pothole", "hole", "road", "crack", "pit"]):
        return "pothole"
    if any(w in text for w in ["garbage", "trash", "waste", "litter", "dump"]):
        return "garbage"
    if any(w in text for w in ["light", "street light", "lamp", "dark", "streetlight"]):
        return "streetlight"
    return "other"
