import React, { useState } from "react";
import { resolveMediaUrl, detectMediaKind } from "../utils/helpers";

interface ReportImageProps {
    imageUrl: string | null | undefined;
    alt?: string;
    className?: string;
}

export default function ReportImage({ imageUrl, alt = "Report evidence", className = "report-timeline-img" }: ReportImageProps) {
    const [failed, setFailed] = useState(false);
    const src = resolveMediaUrl(imageUrl);
    const kind = detectMediaKind(imageUrl);

    if (!src || failed) {
        return (
            <div className="report-image-missing">
                <span>{kind === "audio" ? "🎙️" : kind === "video" ? "🎬" : "📷"}</span>
                <p>Media unavailable</p>
                <span className="form-hint">Older uploads may have been lost after a server redeploy. New reports keep media in cloud storage.</span>
            </div>
        );
    }

    if (kind === "audio") {
        return (
            <div className="report-media-audio">
                <audio controls src={src} preload="metadata" onError={() => setFailed(true)}>
                    Your browser does not support audio playback.
                </audio>
            </div>
        );
    }

    if (kind === "video") {
        return (
            <video
                className={`${className} report-timeline-video`}
                src={src}
                controls
                playsInline
                preload="metadata"
                onError={() => setFailed(true)}
            />
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
