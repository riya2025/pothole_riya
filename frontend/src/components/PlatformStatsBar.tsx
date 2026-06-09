import React from "react";
import { CITIES } from "../config/filters";

interface PlatformStatsBarProps {
    totalReports: number;
    filteredCount?: number;
    cityFilter?: string;
}

export default function PlatformStatsBar({
    totalReports,
    filteredCount,
    cityFilter = "all",
}: PlatformStatsBarProps) {
    const cityCount = CITIES.filter((c) => c.value !== "all").length;

    return (
        <div className="platform-stats-bar">
            <div className="platform-stat">
                <span className="platform-stat-value">{totalReports}</span>
                <span className="platform-stat-label">Reports tracked</span>
            </div>
            <div className="platform-stat-divider" />
            <div className="platform-stat">
                <span className="platform-stat-value">{cityCount}</span>
                <span className="platform-stat-label">Cities</span>
            </div>
            {filteredCount !== undefined && (
                <>
                    <div className="platform-stat-divider" />
                    <div className="platform-stat highlight">
                        <span className="platform-stat-value">{filteredCount}</span>
                        <span className="platform-stat-label">
                            Showing{cityFilter !== "all" ? ` in ${cityFilter}` : ""}
                        </span>
                    </div>
                </>
            )}
            <div className="platform-stat-live">
                <span className="platform-live-dot" />
                Live data
            </div>
        </div>
    );
}
