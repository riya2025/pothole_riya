import React from "react";
import { issueColor } from "../utils/helpers";

const CARDS = [
    {
        type: "pothole",
        label: "Potholes",
        image: "/assets/pothole.jpg",
    },
    {
        type: "streetlight",
        label: "Streetlights",
        image: "/assets/streetlight.svg",
    },
    {
        type: "garbage",
        label: "Garbage",
        image: "/assets/garbage.svg",
    },
] as const;

interface IssueVisualCardsProps {
    compact?: boolean;
}

export default function IssueVisualCards({ compact = false }: IssueVisualCardsProps) {
    return (
        <div className={`issue-visual-cards ${compact ? "compact" : ""}`}>
            {CARDS.map((card) => (
                <div
                    key={card.type}
                    className="issue-visual-card"
                    style={{ "--card-accent": issueColor(card.type) } as React.CSSProperties}
                >
                    <img src={card.image} alt={card.label} className="issue-visual-img" />
                    <span className="issue-visual-label">{card.label}</span>
                </div>
            ))}
        </div>
    );
}
