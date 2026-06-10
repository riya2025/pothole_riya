import React from "react";
import { issueColor } from "../utils/helpers";
import { ISSUE_IMAGES } from "../config/issueAssets";

const GALLERY_ITEMS = [
    {
        type: "pothole",
        label: "Potholes",
        image: ISSUE_IMAGES.pothole,
        blurb: "Road damage & cracks",
    },
    {
        type: "streetlight",
        label: "Streetlights",
        image: ISSUE_IMAGES.streetlight,
        blurb: "Broken or dim lights",
    },
    {
        type: "garbage",
        label: "Garbage",
        image: ISSUE_IMAGES.garbage,
        blurb: "Waste & dumping",
    },
] as const;

interface HeroVisualGalleryProps {
    activeType?: string;
    onTypeSelect?: (type: string) => void;
    compact?: boolean;
}

export default function HeroVisualGallery({
    activeType = "all",
    onTypeSelect,
    compact = false,
}: HeroVisualGalleryProps) {
    return (
        <div className={`hero-gallery-panel ${compact ? "compact" : ""}`}>
            {!compact && (
                <p className="hero-gallery-heading">Tap to filter the map</p>
            )}
            <div className={`hero-gallery ${compact ? "compact" : "bento"}`}>
                {GALLERY_ITEMS.map((item, index) => {
                    const isActive = activeType === item.type;
                    const color = issueColor(item.type);
                    const isFeatured = !compact && index === 0;

                    return (
                        <button
                            key={item.type}
                            type="button"
                            className={[
                                "hero-gallery-card",
                                isActive ? "active" : "",
                                isFeatured ? "featured" : "",
                            ].filter(Boolean).join(" ")}
                            style={{
                                "--gallery-accent": color,
                                "--gallery-delay": `${index * 120}ms`,
                            } as React.CSSProperties}
                            onClick={() => onTypeSelect?.(item.type)}
                            aria-pressed={isActive}
                            aria-label={`Filter ${item.label}`}
                        >
                            <div className="hero-gallery-image-wrap">
                                <img
                                    src={item.image}
                                    alt={item.label}
                                    className="hero-gallery-image"
                                    loading={index === 0 ? "eager" : "lazy"}
                                />
                                <div className="hero-gallery-overlay" />
                                <div className="hero-gallery-shine" aria-hidden />
                            </div>
                            <div className="hero-gallery-caption">
                                <span className="hero-gallery-label">{item.label}</span>
                                {!compact && (
                                    <span className="hero-gallery-blurb">{item.blurb}</span>
                                )}
                            </div>
                            {isActive && (
                                <span className="hero-gallery-active-dot" aria-hidden />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
