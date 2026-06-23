/**
 * Client-side image compression.
 *
 * Real phone photos are often 2–5 MB, which makes uploads slow and hammers the
 * server (Groq base64 + Cloudinary). Resizing to a sensible max dimension and
 * re-encoding as JPEG typically shrinks them 10–30× with no meaningful quality
 * loss for civic complaint photos.
 *
 * IMPORTANT: re-encoding via canvas strips EXIF (including GPS), so read any
 * metadata you need from the ORIGINAL file before compressing.
 */
export interface CompressOptions {
    /** Longest side, in pixels. */
    maxDimension?: number;
    /** JPEG quality, 0–1. */
    quality?: number;
}

export async function compressImage(
    file: File,
    { maxDimension = 1280, quality = 0.7 }: CompressOptions = {},
): Promise<File> {
    // Only re-encode raster formats we can safely rasterize. Leave GIF/SVG alone.
    if (
        !file.type.startsWith("image/") ||
        file.type === "image/gif" ||
        file.type === "image/svg+xml"
    ) {
        return file;
    }

    let bitmap: ImageBitmap;
    try {
        // `from-image` applies EXIF orientation so the output isn't sideways.
        bitmap = await createImageBitmap(file, {
            imageOrientation: "from-image",
        } as unknown as ImageBitmapOptions);
    } catch {
        return file; // Undecodable — just upload the original.
    }

    const { width, height } = bitmap;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        bitmap.close?.();
        return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) {
        return file; // Compression didn't help (already small) — keep original.
    }

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
}
