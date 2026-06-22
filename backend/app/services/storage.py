"""
Persist report images.

Local disk (uploads/) works for development only. On Render/Vercel the filesystem
is ephemeral — files disappear on redeploy. Set Cloudinary env vars in production.
"""
import asyncio
import os
import uuid
import aiofiles
from app.config import settings


def cloudinary_configured() -> bool:
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


async def save_report_image(image_bytes: bytes, image_filename: str | None) -> str | None:
    if not image_bytes:
        return None

    ext = os.path.splitext(image_filename or "")[-1].lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        ext = ".jpg"

    if cloudinary_configured():
        import cloudinary
        import cloudinary.uploader

        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        # cloudinary.uploader.upload is synchronous and would block the asyncio
        # event loop (stalling all other requests). Run it in a worker thread.
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            image_bytes,
            folder="civicwatch/reports",
            resource_type="image",
            public_id=uuid.uuid4().hex,
        )
        return result.get("secure_url")

    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(upload_dir, filename)
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(image_bytes)
    return f"/uploads/{filename}"
