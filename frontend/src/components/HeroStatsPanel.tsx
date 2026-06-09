import React, { useMemo } from "react";
import { issueColor, issueIcon } from "../utils/helpers";
import { Issue } from "../types";
import { CITIES } from "../config/filters";

const TRACKED_TYPES = ["pothole", "garbage", "streetlight", "other"] as const;

interface HeroStatsPanelProps {
    issues: Issue[];
    compact?: boolean;
}

export default function HeroStatsPanel({ issues, compact = false }: HeroStatsPanelProps) {
    const stats = useMemo(() => {
        const byType = TRACKED_TYPES.map((type) => ({
            type,
            count: issues.filter((i) => i.type === type).length,
        }));
        const max = Math.max(...byType.map((t) => t.count), 1);
        const cityCount = CITIES.filter((c) => c.value !== "all").length;
        return { byType, max, total: issues.length, cityCount };
    }, [issues]);

    return (
        <div className={`hero-stats-panel ${compact ? "compact" : ""}`}>
            <div className="hero-stats-panel-glow" aria-hidden="true" />

            <div className="hero-stats-header">
                <span className="hero-stats-live">
                    <span className="hero-stats-pulse" />
                    Live
                </span>
                <span className="hero-stats-total-label">Reports tracked</span>
                <span className="hero-stats-total">{stats.total}</span>
            </div>

            <div className="hero-stats-breakdown">
                {stats.byType.map(({ type, count }) => {
                    const pct = Math.round((count / stats.max) * 100);
                    const color = issueColor(type);
                    return (
                        <div key={type} className="hero-stats-row">
                            <div className="hero-stats-row-icon" style={{ background: `${color}22`, color }}>
                                {issueIcon(type)}
                            </div>
                            <div className="hero-stats-row-body">
                                <div className="hero-stats-row-top">
                                    <span className="hero-stats-row-name">{type}</span>
                                    <span className="hero-stats-row-count" style={{ color }}>{count}</span>
                                </div>
                                <div className="hero-stats-bar-track">
                                    <div
                                        className="hero-stats-bar-fill"
                                        style={{ width: `${pct}%`, background: color }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="hero-stats-footer">
                <span>{stats.cityCount} cities</span>
                <span className="hero-stats-footer-dot">·</span>
                <span>AI-classified</span>
            </div>
        </div>
    );
}
