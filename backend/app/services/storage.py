"""
Persist report media (images, short videos, voice notes).

Local disk (uploads/) works for development only. On Render/Vercel the filesystem
is ephemeral — files disappear on redeploy. Set Cloudinary env vars in production.
"""
import asyncio
import os
import uuid
import aiofiles
from app.config import settings

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v"}


def cloudinary_configured() -> bool:
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def media_kind(filename: str | None, content_type: str | None = None) -> str:
    """Return 'image' | 'video' | 'audio' based on MIME and/or filename."""
    name = (filename or "").lower()
    # Prefer explicit Quick Report filename prefixes over ambiguous .webm MIME types.
    if name.startswith("voice_") or "/voice_" in name or name.startswith("voice."):
        return "audio"
    if name.startswith("video_") or "/video_" in name:
        return "video"

    mime = (content_type or "").lower().split(";")[0].strip()
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("audio/"):
        return "audio"

    ext = os.path.splitext(filename or "")[-1].lower()
    if ext in IMAGE_EXTS:
        return "image"
    if ext in {".mp3", ".wav", ".ogg", ".m4a", ".aac"}:
        return "audio"
    if ext in VIDEO_EXTS:
        return "video"
    return "image"


def _extension_for(filename: str | None, kind: str, content_type: str | None = None) -> str:
    ext = os.path.splitext(filename or "")[-1].lower()
    if ext and len(ext) <= 5:
        return ext

    mime = (content_type or "").lower()
    if "png" in mime:
        return ".png"
    if "webp" in mime:
        return ".webp"
    if "wav" in mime:
        return ".wav"
    if "mpeg" in mime or "mp3" in mime:
        return ".mp3"
    if "ogg" in mime:
        return ".ogg"
    if "mp4" in mime or "m4a" in mime:
        return ".mp4" if kind != "audio" else ".m4a"
    if kind == "video":
        return ".webm"
    if kind == "audio":
        return ".webm"
    return ".jpg"


async def save_report_image(image_bytes: bytes, image_filename: str | None) -> str | None:
    """Backward-compatible alias for image uploads."""
    return await save_report_media(image_bytes, image_filename, content_type="image/jpeg")


async def save_report_media(
    media_bytes: bytes,
    media_filename: str | None,
    content_type: str | None = None,
) -> str | None:
    if not media_bytes:
        return None

    kind = media_kind(media_filename, content_type)
    ext = _extension_for(media_filename, kind, content_type)

    if cloudinary_configured():
        import cloudinary
        import cloudinary.uploader

        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        # Images stay on resource_type=image; video + audio use "video" on Cloudinary.
        resource_type = "image" if kind == "image" else "video"
        # Prefix public_id so the frontend can tell video vs voice from the URL.
        prefix = {"image": "img", "video": "video", "audio": "voice"}.get(kind, "media")
        try:
            result = await asyncio.to_thread(
                cloudinary.uploader.upload,
                media_bytes,
                folder="civicwatch/reports",
                resource_type=resource_type,
                public_id=f"{prefix}_{uuid.uuid4().hex}",
            )
            url = result.get("secure_url")
            print(f"[storage] uploaded to Cloudinary ({kind}): {url}")
            return url
        except Exception as exc:
            print(f"[storage] Cloudinary upload failed ({kind}): {exc}")
            raise

    print(
        "[storage] Cloudinary env vars missing — saving to local uploads/ "
        "(set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in backend/.env)"
    )
    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)
    prefix = {"image": "img", "video": "video", "audio": "voice"}.get(kind, "media")
    filename = f"{prefix}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(upload_dir, filename)
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(media_bytes)
    return f"/uploads/{filename}"
