"""
Extract a few still frames from short Quick Report videos for Groq vision.
"""
from __future__ import annotations

import io
import os
import tempfile
from typing import List

import numpy as np

# Prefer imageio + bundled ffmpeg; fall back gracefully if unavailable.
try:
    import imageio.v2 as imageio
    import imageio_ffmpeg  # noqa: F401 — registers ffmpeg plugin

    _IMAGEIO_OK = True
except Exception:
    _IMAGEIO_OK = False

try:
    from PIL import Image

    _PIL_OK = True
except Exception:
    _PIL_OK = False


def _to_jpeg_bytes(frame: np.ndarray, max_width: int = 512, quality: int = 65) -> bytes | None:
    if not _PIL_OK:
        return None
    if frame is None or getattr(frame, "size", 0) == 0:
        return None

    img = Image.fromarray(frame)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    elif img.mode == "L":
        img = img.convert("RGB")

    if img.width > max_width:
        ratio = max_width / img.width
        img = img.resize((max_width, max(1, int(img.height * ratio))), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def _sharpness(frame: np.ndarray) -> float:
    """Laplacian variance — higher ≈ sharper (prefer these for vision)."""
    if frame is None or frame.size == 0:
        return 0.0
    if frame.ndim == 3:
        # simple luma
        gray = (
            0.299 * frame[:, :, 0].astype(np.float32)
            + 0.587 * frame[:, :, 1].astype(np.float32)
            + 0.114 * frame[:, :, 2].astype(np.float32)
        )
    else:
        gray = frame.astype(np.float32)
    # 3x3 Laplacian kernel via finite differences
    if gray.shape[0] < 3 or gray.shape[1] < 3:
        return float(gray.var())
    lap = (
        -4 * gray[1:-1, 1:-1]
        + gray[:-2, 1:-1]
        + gray[2:, 1:-1]
        + gray[1:-1, :-2]
        + gray[1:-1, 2:]
    )
    return float(lap.var())


def _suffix_for(filename: str | None, content_type: str | None) -> str:
    name = (filename or "").lower()
    mime = (content_type or "").lower()
    if name.endswith(".webm") or "webm" in mime:
        return ".webm"
    if name.endswith(".mov") or "quicktime" in mime:
        return ".mov"
    return ".mp4"


def extract_video_frames(
    video_bytes: bytes,
    *,
    filename: str | None = None,
    content_type: str | None = None,
    max_frames: int = 1,
    max_width: int = 640,
) -> List[bytes]:
    """
    Return up to `max_frames` JPEG frames sampled across the clip,
    preferring sharper frames when extras are available.

    Defaults are tuned for Groq free-tier TPM: one small frame (~640px).
    """
    if not video_bytes or not _IMAGEIO_OK or not _PIL_OK:
        return []

    suffix = _suffix_for(filename, content_type)
    tmp_path = None
    reader = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(video_bytes)
            tmp_path = tmp.name

        reader = imageio.get_reader(tmp_path)
        try:
            meta = reader.get_meta_data()
        except Exception:
            meta = {}

        nframes = None
        try:
            nframes = int(reader.count_frames())
        except Exception:
            nframes = None

        fps = float(meta.get("fps") or 0) or 24.0
        duration = float(meta.get("duration") or 0)
        if (not duration or duration <= 0) and nframes:
            duration = nframes / fps

        # Candidate timestamps across the clip (avoid exact first/last edge).
        # Sample several points and keep the sharpest — that frame is what we
        # store instead of uploading the whole video.
        if duration and duration > 0.2:
            if max_frames <= 1:
                stamps = [duration * 0.5]
            else:
                stamps = [
                    duration * (0.15 + 0.7 * i / (max_frames - 1))
                    for i in range(max_frames)
                ]
            # Extras for sharpness ranking (clear issue usually mid-clip)
            extra = [duration * t for t in (0.2, 0.35, 0.5, 0.65, 0.8)]
            stamps = list(dict.fromkeys([*stamps, *extra]))  # unique, keep order
        elif nframes and nframes > 0:
            idxs = [
                max(0, min(nframes - 1, int(nframes * (0.15 + 0.7 * i / max(max_frames - 1, 1)))))
                for i in range(max_frames)
            ]
            stamps = None
        else:
            # Last resort: grab a handful of sequential frames
            idxs = list(range(min(8, max_frames * 2)))
            stamps = None

        scored: list[tuple[float, bytes]] = []

        if stamps is not None:
            for t in stamps:
                try:
                    # imageio get_data uses frame index; convert via fps
                    idx = int(max(0, t * fps))
                    if nframes:
                        idx = min(idx, nframes - 1)
                    frame = reader.get_data(idx)
                except Exception:
                    continue
                jpeg = _to_jpeg_bytes(np.asarray(frame), max_width=max_width)
                if jpeg:
                    scored.append((_sharpness(np.asarray(frame)), jpeg))
        else:
            for idx in idxs:
                try:
                    frame = reader.get_data(idx)
                except Exception:
                    continue
                jpeg = _to_jpeg_bytes(np.asarray(frame), max_width=max_width)
                if jpeg:
                    scored.append((_sharpness(np.asarray(frame)), jpeg))

        if not scored:
            # Sequential read fallback
            try:
                for i, frame in enumerate(reader):
                    jpeg = _to_jpeg_bytes(np.asarray(frame), max_width=max_width)
                    if jpeg:
                        scored.append((_sharpness(np.asarray(frame)), jpeg))
                    if i >= max_frames * 3:
                        break
            except Exception:
                pass

        if not scored:
            return []

        # Prefer sharper frames; keep temporal diversity by taking top-N by sharpness
        scored.sort(key=lambda x: x[0], reverse=True)
        return [jpeg for _, jpeg in scored[:max_frames]]
    except Exception:
        return []
    finally:
        if reader is not None:
            try:
                reader.close()
            except Exception:
                pass
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
