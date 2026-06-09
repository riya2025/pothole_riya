import React, { useState } from "react";
import { issueColor, issueIcon } from "../utils/helpers";

const LEGEND_TYPES = ["pothole", "garbage", "streetlight", "other"] as const;

export default function MapLegend() {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className={`map-legend ${collapsed ? "collapsed" : ""}`}>
            <button
                type="button"
                className="map-legend-toggle"
                onClick={() => setCollapsed((c) => !c)}
                aria-expanded={!collapsed}
                aria-label={collapsed ? "Expand map legend" : "Collapse map legend"}
            >
                <span className="map-legend-title">Issue Types</span>
                <svg className="map-legend-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </button>
            {!collapsed && (
                <div className="map-legend-items">
                    {LEGEND_TYPES.map((t) => (
                        <div key={t} className="legend-chip" style={{ "--chip-color": issueColor(t) } as React.CSSProperties}>
                            <span className="legend-chip-dot" />
                            <span className="legend-chip-icon">{issueIcon(t)}</span>
                            <span className="legend-chip-label">{t}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
