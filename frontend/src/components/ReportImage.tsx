import React, { useState } from "react";
import { resolveMediaUrl } from "../utils/helpers";

interface ReportImageProps {
    imageUrl: string | null | undefined;
    alt?: string;
    className?: string;
}

export default function ReportImage({ imageUrl, alt = "Report evidence", className = "report-timeline-img" }: ReportImageProps) {
    const [failed, setFailed] = useState(false);
    const src = resolveMediaUrl(imageUrl);

    if (!src || failed) {
        return (
            <div className="report-image-missing">
                <span>📷</span>
                <p>Image unavailable</p>
                <span className="form-hint">Older uploads may have been lost after a server redeploy. New reports keep images in cloud storage.</span>
            </div>
        );
    }

    return (
        <a href={src} target="_blank" rel="noopener noreferrer">
            <img
                src={src}
                alt={alt}
                className={className}
                loading="lazy"
                onError={() => setFailed(true)}
            />
        </a>
    );
}
