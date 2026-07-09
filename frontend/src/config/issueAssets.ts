/**
 * Issue type photos (served from public/assets — copied from /images).
 */
export const ISSUE_IMAGES: Record<string, string> = {
    pothole: "/assets/pothole.png",
    streetlight: "/assets/streetlight.png",
    garbage: "/assets/garbage.jpg",
    other: "/assets/other.svg",
};

/** Faded card watermark image for an issue type (falls back to "other"). */
export function issueWatermarkUrl(type: string | null | undefined): string {
    const key = (type || "other").trim().toLowerCase();
    return ISSUE_IMAGES[key] || ISSUE_IMAGES.other;
}
