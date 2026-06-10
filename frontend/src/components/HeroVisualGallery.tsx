import React from "react";
import { issueColor } from "../utils/helpers";

const GALLERY_ITEMS = [
    {
        type: "pothole",
        label: "Potholes",
        image: "/assets/pothole.png",
        blurb: "Road damage & cracks",
    },
    {
        type: "streetlight",
        label: "Streetlights",
        image: "/assets/streetlight.png",
        blurb: "Broken or dim lights",
    },
    {
        type: "garbage",
        label: "Garbage",
        image: "/assets/garbage.jpg",
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
        <div className={`hero-gallery ${compact ? "compact" : ""}`}>
            {GALLERY_ITEMS.map((item, index) => {
                const isActive = activeType === item.type;
                const color = issueColor(item.type);
                return (
                    <button
                        key={item.type}
                        type="button"
                        className={`hero-gallery-card ${isActive ? "active" : ""}`}
                        style={{
                            "--gallery-accent": color,
                            "--gallery-delay": `${index * 80}ms`,
                        } as React.CSSProperties}
                        onClick={() => onTypeSelect?.(item.type)}
                        aria-pressed={isActive}
                        aria-label={`Filter ${item.label}`}
                    >
                        <div className="hero-gallery-image-wrap">
                            <img src={item.image} alt={item.label} className="hero-gallery-image" />
                            <div className="hero-gallery-overlay" />
                        </div>
                        <div className="hero-gallery-caption">
                            <span className="hero-gallery-label">{item.label}</span>
                            {!compact && <span className="hero-gallery-blurb">{item.blurb}</span>}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
