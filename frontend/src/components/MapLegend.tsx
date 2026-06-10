import React, { useState } from "react";
import { issueColor, issueImageUrl } from "../utils/helpers";
import IssueTypeIcon from "./IssueTypeIcon";

const LEGEND_TYPES = ["pothole", "garbage", "streetlight", "other"] as const;

interface MapLegendProps {
    activeType?: string;
    onTypeSelect?: (type: string) => void;
}

export default function MapLegend({ activeType = "all", onTypeSelect }: MapLegendProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className={`map-legend ${collapsed ? "collapsed" : ""}`}>
            <button
                type="button"
                className="map-legend-toggle"
                onClick={() => setCollapsed((c) => !c)}
                aria-expanded={!collapsed}
            >
                <span className="map-legend-title">Filter by type</span>
                <svg className="map-legend-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </button>
            {!collapsed && (
                <div className="map-legend-items">
                    {LEGEND_TYPES.map((t) => {
                        const isActive = activeType === t;
                        return (
                            <button
                                key={t}
                                type="button"
                                className={`legend-chip ${isActive ? "active" : ""}`}
                                style={{ "--chip-color": issueColor(t) } as React.CSSProperties}
                                onClick={() => onTypeSelect?.(t)}
                                aria-pressed={isActive}
                            >
                                {issueImageUrl(t) ? (
                                    <IssueTypeIcon type={t} size={18} className="legend-chip-thumb" />
                                ) : (
                                    <span className="legend-chip-dot" />
                                )}
                                <span className="legend-chip-label">{t}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
