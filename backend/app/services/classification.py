"""
Issue classification + auto-description.

Vision cascade: Groq → Gemini → manual-friendly failure text.
Text classification still uses Groq when available, else keywords.
"""
import base64
import json
import re

import httpx
from app.config import settings
from app.services.storage import media_kind
from app.services.video_frames import extract_video_frames
from app.services.groq_models import (
    resolve_vision_model,
    resolve_text_model,
    vision_model_supports_json_mode,
    list_model_ids,
)

VALID_TYPES = {"pothole", "garbage", "streetlight", "other"}
MAX_DESCRIPTION_LEN = 240

VISION_ANALYZE_PROMPT = """Look at this photo of a civic issue and respond with JSON only, no other text:
{"category":"<name>","description":"<one short factual sentence>"}

<name> must be exactly one of: pothole, garbage, streetlight, other
pothole = road damage, holes, cracks, broken asphalt (even thin cracks)
garbage = trash, waste, litter, overflowing bins, dumping
streetlight = broken street lamps, dark areas from failed lighting
other = manhole covers, poles, drains, OR unclear / shadow-only marks

CRITICAL rules for "description":
- Describe ONLY what is visibly present. Never invent a manhole, drain, or lamp
  if you do not clearly see one.
- If it looks like a shadow or faint mark, say that (e.g. "Dark linear shadow or
  faint crack on the asphalt near the lane markings").
- If it is a real crack/pothole, use category "pothole" and say so.
Good examples:
- "Long thin crack in the asphalt near the yellow lane markings"
- "Open or displaced manhole cover on the road"
- "Broken streetlight glass hanging from the fixture"
- "Dark shadow across the pavement — possible crack, needs closer look"
Bad (do not use): "Civic issue visible", "Needs attention", inventing a manhole.
One concise sentence under 30 words. No emojis."""

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

# Kept for reference / future multi-frame mode; single-frame path uses VISION_ANALYZE_PROMPT.
VIDEO_ANALYZE_PROMPT = VISION_ANALYZE_PROMPT


def _strip_think_blocks(text: str) -> str:
    """Remove Qwen-style <think>...</think> reasoning wrappers."""
    if not text:
        return ""
    # Closed think blocks
    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE).strip()
    if cleaned and "<think" not in cleaned.lower():
        return cleaned
    # Unclosed / truncated think — do not leak reasoning into the UI description.
    if re.search(r"<think", text, flags=re.IGNORECASE):
        after = re.split(r"</think>", text, flags=re.IGNORECASE)
        if len(after) > 1:
            tail = after[-1].strip()
            if tail and "<think" not in tail.lower():
                return tail
        return ""
    return text.strip()


def _extract_json_object(text: str) -> dict | None:
    cleaned = _strip_think_blocks(text)
    # Prefer content after think, but also search original for a JSON object.
    for candidate in (cleaned, text or ""):
        if not candidate:
            continue
        try:
            data = json.loads(candidate.strip())
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
        match = re.search(r"\{[^{}]*\"category\"[^{}]*\}", candidate, flags=re.IGNORECASE | re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                pass
        # Broader brace match
        match = re.search(r"\{[\s\S]*\}", candidate)
        if match:
            try:
                data = json.loads(match.group(0))
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                pass
    return None


def _extract_category_field(text: str) -> str | None:
    """Pull category from JSON-ish or 'category: pothole' lines (works mid-think)."""
    if not text:
        return None
    patterns = [
        r'["\']category["\']\s*:\s*["\'](pothole|garbage|streetlight|other)["\']',
        r'\bcategory\s*[:=]\s*["\']?(pothole|garbage|streetlight|other)["\']?',
    ]
    for pat in patterns:
        matches = re.findall(pat, text, flags=re.IGNORECASE)
        if matches:
            # Prefer the last explicit assignment (usually the conclusion)
            cat = str(matches[-1]).strip().lower()
            if cat in VALID_TYPES:
                return cat
    return None


def _extract_description_field(text: str) -> str:
    if not text:
        return ""
    patterns = [
        r'["\']description["\']\s*:\s*["\']([^"\']+)["\']',
        r'\bdescription\s*[:=]\s*["\']([^"\']+)["\']',
    ]
    for pat in patterns:
        matches = re.findall(pat, text, flags=re.IGNORECASE)
        if matches:
            return _clean_description(matches[-1])
    return ""


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
    data = _extract_json_object(raw or "")
    if data:
        cat = str(data.get("category", "")).strip().lower()
        if cat in VALID_TYPES:
            return cat

    cat = _extract_category_field(raw or "")
    if cat:
        return cat

    # Only as last resort on short, clean answers (avoid matching prompt/think lists)
    text = _strip_think_blocks(raw or "").strip().lower()
    if text in VALID_TYPES:
        return text
    if len(text) <= 40:
        for cat in ("streetlight", "pothole", "garbage", "other"):
            if re.fullmatch(rf"\W*{cat}\W*", text):
                return cat
    return None


def _is_bad_description(text: str) -> bool:
    t = (text or "").strip().lower()
    if not t or "<think" in t:
        return True
    return any(
        b in t
        for b in (
            "civic issue visible",
            "needs attention",
            "needs inspection",
            "something on the",
            "the user wants",
            "identify the object",
        )
    )


def _clean_description(raw: str | None) -> str:
    text = (raw or "").strip().strip('"').strip()
    text = re.sub(r"\s+", " ", text)
    if len(text) > MAX_DESCRIPTION_LEN:
        text = text[:MAX_DESCRIPTION_LEN].rsplit(" ", 1)[0].rstrip() + "…"
    return text


def _fallback_description(category: str) -> str:
    # Keep these category-neutral — never invent a manhole/lamp for every "other".
    return {
        "pothole": "Road surface damage that looks like a pothole or crack.",
        "garbage": "Garbage or litter piled on the roadside.",
        "streetlight": "Damaged or non-working streetlight.",
        "other": "Unclear mark or fixture on the road — please confirm from the photo.",
    }.get(category, "Road or street issue visible in the photo.")


def _analyze_failed_description() -> str:
    """Shown when Groq vision is unavailable (quota / network) — not a fake scene label."""
    return "Could not auto-describe this photo — please write a short description."


def _parse_analyze_response(raw: str | None) -> tuple[str, str]:
    category = ""
    description = ""
    data = _extract_json_object(raw or "")
    if data:
        cat = str(data.get("category", "")).strip().lower()
        if cat in VALID_TYPES:
            category = cat
        description = _clean_description(str(data.get("description", "")))
    if not category:
        category = _extract_category_field(raw or "") or ""
    if not description:
        description = _extract_description_field(raw or "")
    if not category:
        category = _parse_groq_category(raw or "") or "other"
    # UI needs a sentence — never leave description blank when we have a category.
    if category and not description:
        description = _fallback_description(category)
    return category, description


async def _groq_chat(payload: dict, *, retries: int = 2) -> str | None:
    """Call Groq chat completions with retry/backoff on rate limits (429).

    Keep waits short so the report form's /analyze call can fail fast and the
    UI can show a fallback description instead of hanging for minutes.
    """
    if not settings.GROQ_API_KEY:
        return None
    import asyncio
    import random

    last_err = None
    for attempt in range(retries):
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
                if response.status_code == 429:
                    last_err = response.text[:240]
                    body = response.text or ""
                    # Daily token budget exhausted — retries only waste time and make it worse.
                    if re.search(r"tokens per day|TPD", body, flags=re.I):
                        print(f"[groq] daily token limit hit; failing fast: {last_err}")
                        return None
                    # Honor Retry-After when present; else parse "try again in Xs"
                    wait = None
                    ra = response.headers.get("retry-after")
                    if ra:
                        try:
                            wait = float(ra)
                        except ValueError:
                            wait = None
                    if wait is None:
                        m = re.search(r"try again in ([0-9.]+)s", body, flags=re.I)
                        wait = float(m.group(1)) if m else (2 + attempt * 3)
                    # Cap hard — long sleeps block the whole analyze request.
                    wait = min(max(wait, 0.5) + random.uniform(0, 0.5), 8.0)
                    print(f"[groq] rate limited; sleeping {wait:.1f}s (attempt {attempt+1}/{retries})")
                    await asyncio.sleep(wait)
                    continue
                if response.status_code >= 400:
                    print(
                        f"[groq] HTTP {response.status_code} model={payload.get('model')}: "
                        f"{response.text[:300]}"
                    )
                    return None
                result = response.json()
                return result["choices"][0]["message"]["content"]
        except Exception as exc:
            last_err = str(exc)
            print(f"[groq] request failed: {exc}")
            await asyncio.sleep(2 + attempt)
    if last_err:
        print(f"[groq] giving up after retries: {last_err}")
    return None


def _vision_max_tokens(model: str | None) -> int:
    # With reasoning disabled, Qwen only needs room for the short JSON answer.
    if model and model.startswith("qwen/"):
        return 220
    return 160


def _vision_payload(model: str, content: list, *, max_tokens: int | None = None, temperature: float) -> dict:
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": max_tokens if max_tokens is not None else _vision_max_tokens(model),
        "temperature": temperature,
    }
    if vision_model_supports_json_mode(model):
        payload["response_format"] = {"type": "json_object"}
    # Groq Qwen3.6 burns daily TPD on <think>; turn reasoning off for classify/describe.
    if model and model.startswith("qwen/"):
        payload["reasoning_effort"] = "none"
    return payload


async def _classify_from_image(
    description: str,
    image_bytes: bytes,
    image_mime: str,
) -> str | None:
    model = await resolve_vision_model()
    if not model:
        return None
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    data_url = f"data:{image_mime};base64,{b64}"
    desc_bit = (description or "").strip()
    text_prompt = VISION_USER_PROMPT
    if desc_bit:
        text_prompt += f'\n\nReporter also wrote: "{desc_bit}"'

    raw = await _groq_chat(
        _vision_payload(
            model,
            [
                {"type": "text", "text": text_prompt},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
            temperature=0,
        )
    )
    return _parse_groq_category(raw or "")


def _prepare_vision_jpeg(
    image_bytes: bytes,
    image_filename: str | None = None,
) -> tuple[bytes, str]:
    """Downscale stills before vision calls to stay within free-tier limits."""
    try:
        from PIL import Image
        import io as _io

        img = Image.open(_io.BytesIO(image_bytes)).convert("RGB")
        max_w = getattr(settings, "VISION_FRAME_MAX_WIDTH", None) or 512
        quality = getattr(settings, "VISION_JPEG_QUALITY", None) or 65
        quality = min(int(quality), 65)
        if img.width > max_w:
            ratio = max_w / img.width
            img = img.resize((max_w, max(1, int(img.height * ratio))), Image.Resampling.LANCZOS)
        buf = _io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        return buf.getvalue(), "frame.jpg"
    except Exception:
        return image_bytes, image_filename or "frame.jpg"


def _finalize_analyze(category: str, description: str, source: str) -> dict:
    category = (category or "other").strip().lower() or "other"
    if category not in VALID_TYPES:
        category = "other"
    if _is_bad_description(description):
        description = _fallback_description(category)
    return {"category": category, "description": description, "source": source}


def _vision_result_ok(result: dict | None) -> bool:
    if not result:
        return False
    src = (result.get("source") or "").lower()
    if "failed" in src or src in {"unavailable", "no_frames"}:
        return False
    desc = (result.get("description") or "").strip().lower()
    if not desc or desc.startswith("could not auto-describe"):
        return False
    return True


async def _analyze_with_groq(image_bytes: bytes, mime: str) -> dict | None:
    model = await resolve_vision_model()
    if not (settings.GROQ_API_KEY and model):
        return None

    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime};base64,{b64}"

    raw = await _groq_chat(
        _vision_payload(
            model,
            [
                {"type": "text", "text": VISION_ANALYZE_PROMPT},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
            max_tokens=280 if not (model or "").startswith("qwen/") else None,
            temperature=0.2,
        )
    )
    if not raw:
        return None

    category, description = _parse_analyze_response(raw)
    if _is_bad_description(description):
        description = ""

    # One short rewrite only when we got a category but a useless sentence.
    if category and _is_bad_description(description) and raw:
        retry_raw = await _groq_chat(
            _vision_payload(
                model,
                [
                    {
                        "type": "text",
                        "text": (
                            "Describe this civic issue in ONE short factual sentence for a "
                            "complaint form. Name only what you clearly see (crack, shadow, "
                            "pothole, manhole, drain, lamp, trash, pole). Do NOT invent a "
                            "manhole if none is visible. Reply with that sentence only — "
                            "no JSON, no reasoning tags, under 30 words."
                        ),
                    },
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
                max_tokens=80 if not (model or "").startswith("qwen/") else 120,
                temperature=0.3,
            ),
            retries=1,
        )
        retry_desc = _clean_description(_strip_think_blocks(retry_raw or ""))
        if not _is_bad_description(retry_desc):
            description = retry_desc

    return _finalize_analyze(category, description, "groq_vision")


async def _gemini_generate(image_bytes: bytes, mime: str, prompt: str) -> str | None:
    """Call Gemini generateContent (REST). Returns model text or None."""
    api_key = (settings.GEMINI_API_KEY or "").strip()
    if not api_key:
        return None

    model = (settings.GEMINI_VISION_MODEL or "gemini-2.0-flash").strip()
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime or "image/jpeg",
                            "data": b64,
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 256,
            "responseMimeType": "application/json",
        },
    }
    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            response = await client.post(url, params={"key": api_key}, json=payload)
            if response.status_code >= 400:
                print(
                    f"[gemini] HTTP {response.status_code} model={model}: "
                    f"{response.text[:300]}"
                )
                return None
            data = response.json()
            parts = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [])
            )
            texts = [p.get("text", "") for p in parts if isinstance(p, dict)]
            return "\n".join(t for t in texts if t).strip() or None
    except Exception as exc:
        print(f"[gemini] request failed: {exc}")
        return None


async def _analyze_with_gemini(image_bytes: bytes, mime: str) -> dict | None:
    if not (settings.GEMINI_API_KEY or "").strip():
        return None
    raw = await _gemini_generate(image_bytes, mime, VISION_ANALYZE_PROMPT)
    if not raw:
        return None
    category, description = _parse_analyze_response(raw)
    if not category and _is_bad_description(description):
        return None
    return _finalize_analyze(category, description, "gemini_vision")


async def analyze_issue_photo(
    image_bytes: bytes,
    image_filename: str | None = None,
) -> dict:
    """
    Auto category + description for a photo.
    Cascade: Groq vision → Gemini vision → manual-friendly failure text.
    """
    if not image_bytes:
        return {"category": "", "description": "", "source": "unavailable"}

    has_groq = bool((settings.GROQ_API_KEY or "").strip())
    has_gemini = bool((settings.GEMINI_API_KEY or "").strip())
    if not (has_groq or has_gemini):
        return {"category": "", "description": "", "source": "unavailable"}

    image_bytes, image_filename = _prepare_vision_jpeg(image_bytes, image_filename)
    mime = _guess_mime(image_filename) or "image/jpeg"

    if has_groq:
        groq_result = await _analyze_with_groq(image_bytes, mime)
        if _vision_result_ok(groq_result):
            return groq_result
        print("[vision] Groq unavailable/failed; trying Gemini fallback")

    if has_gemini:
        gemini_result = await _analyze_with_gemini(image_bytes, mime)
        if _vision_result_ok(gemini_result):
            return gemini_result
        print("[vision] Gemini unavailable/failed")

    return {
        "category": "other",
        "description": _analyze_failed_description(),
        "source": "vision_failed",
    }


async def analyze_issue_video(
    video_bytes: bytes,
    video_filename: str | None = None,
    content_type: str | None = None,
    description: str = "",
) -> dict:
    """
    Extract the sharpest small frame from a short video and run vision.
    Cascade matches analyze_issue_photo (Groq → Gemini → manual).
    """
    has_provider = bool(
        (settings.GROQ_API_KEY or "").strip() or (settings.GEMINI_API_KEY or "").strip()
    )
    if not (video_bytes and has_provider):
        return {"category": "", "description": "", "source": "unavailable", "frames_used": 0}

    frames = extract_video_frames(
        video_bytes,
        filename=video_filename,
        content_type=content_type,
        max_frames=1,
        max_width=getattr(settings, "VISION_FRAME_MAX_WIDTH", None) or 512,
    )
    if not frames:
        return {"category": "", "description": "", "source": "no_frames", "frames_used": 0}

    primary = await analyze_issue_photo(frames[0], "frame.jpg")
    category = (primary.get("category") or "other").strip().lower() or "other"
    if category not in VALID_TYPES:
        category = "other"
    description = (primary.get("description") or "").strip()
    if _is_bad_description(description):
        # Keep the explicit "could not auto-describe" message for the UI cascade.
        if not (description or "").lower().startswith("could not auto-describe"):
            description = _fallback_description(category)
    return {
        "category": category,
        "description": description,
        "source": primary.get("source") or "vision_video",
        "frames_used": 1,
    }


async def _classify_from_text(description: str) -> str | None:
    model = await resolve_text_model()
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": TEXT_SYSTEM_PROMPT},
            {"role": "user", "content": description or "unspecified issue"},
        ],
        "max_tokens": 48,
        "temperature": 0,
    }
    # Text models generally support json mode; qwen sometimes wraps think tags anyway.
    if vision_model_supports_json_mode(model) or model.startswith("llama"):
        payload["response_format"] = {"type": "json_object"}
    raw = await _groq_chat(payload)
    return _parse_groq_category(raw or "")


async def classify_issue(
    description: str,
    image_bytes: bytes | None = None,
    image_filename: str | None = None,
    media_content_type: str | None = None,
) -> tuple[str, str]:
    """
    Classify issue type. Prefers Groq vision on photo or video frames, then text, then keywords.
    Returns (category, source) where source is groq_vision | groq_vision_video | groq | keywords.
    """
    if image_bytes and settings.GROQ_API_KEY:
        kind = media_kind(image_filename, media_content_type)
        if kind == "video":
            result = await analyze_issue_video(
                image_bytes,
                video_filename=image_filename,
                content_type=media_content_type,
                description=description,
            )
            if result.get("category"):
                return result["category"], result.get("source") or "groq_vision_video"
        elif kind == "image":
            mime = _guess_mime(image_filename)
            category = await _classify_from_image(description, image_bytes, mime)
            if category:
                return category, "groq_vision"

    if settings.GROQ_API_KEY:
        category = await _classify_from_text(description)
        if category:
            return category, "groq"

    return _keyword_classify(description), "keywords"


async def refine_report_from_media(
    description: str,
    media_bytes: bytes | None,
    media_filename: str | None = None,
    media_content_type: str | None = None,
) -> dict:
    """
    Full refine for background finalize: category + optional improved description.
    """
    if not media_bytes:
        category, source = await classify_issue(description)
        return {"category": category, "description": "", "source": source}

    kind = media_kind(media_filename, media_content_type)
    if kind == "video":
        result = await analyze_issue_video(
            media_bytes,
            video_filename=media_filename,
            content_type=media_content_type,
            description=description,
        )
        if result.get("category"):
            return result
    elif kind == "image":
        result = await analyze_issue_photo(media_bytes, media_filename)
        if result.get("category"):
            return result

    category, source = await classify_issue(description)
    return {"category": category, "description": "", "source": source}


async def groq_status() -> dict:
    """Check Groq/Gemini text + vision model configuration."""
    sample = "garabage overloaded near my home"
    text_model = await resolve_text_model()
    vision_model = await resolve_vision_model()
    gemini_configured = bool((settings.GEMINI_API_KEY or "").strip())
    base = {
        "text_model": text_model,
        "vision_model": vision_model,
        "configured_vision_model": settings.GROQ_VISION_MODEL or None,
        "gemini_configured": gemini_configured,
        "gemini_vision_model": (settings.GEMINI_VISION_MODEL or None) if gemini_configured else None,
        "sample_input": sample,
    }
    if not settings.GROQ_API_KEY:
        return {
            **base,
            "configured": gemini_configured,
            "working": False,
            "vision_enabled": gemini_configured,
            "vision_model_available": gemini_configured,
            "video_frames_enabled": True,
        }

    category, source = await classify_issue(sample)
    ids = await list_model_ids()
    vision_ok = bool(vision_model and vision_model in ids) or gemini_configured

    return {
        **base,
        "configured": True,
        "working": True,
        "sample_classification": category,
        "classification_source": source,
        "groq_active": source in ("groq", "groq_vision", "groq_vision_video"),
        "vision_enabled": vision_ok,
        "video_frames_enabled": True,
        "vision_model_available": vision_ok,
        "available_model_count": len(ids),
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


def is_placeholder_description(description: str | None) -> bool:
    """True for auto text that vision / the user should replace."""
    text = (description or "").strip().lower()
    if not text:
        return True
    return (
        text.startswith("quick traffic report")
        or text.startswith("could not auto-describe")
        or text.startswith("unclear mark or fixture")
        or text.startswith("issue shown in the uploaded")
    )
