import React, { useState, useEffect } from "react";
import MapView from "../components/MapView";
import { getAllIssues } from "../services/api";
import { issueIcon, issueColor } from "../utils/helpers";
import { Issue } from "../types";

export default function Home() {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        getAllIssues()
            .then((res) => setIssues(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = filter === "all" ? issues : issues.filter((i) => i.type === filter);

    const counts: Record<string, number> = ["pothole", "garbage", "streetlight", "other"].reduce((acc, t) => {
        acc[t] = issues.filter((i) => i.type === t).length;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="home-page">
            <div className="stats-bar">
                <div className="stat-item">
                    <span className="stat-number">{issues.length}</span>
                    <span className="stat-label">Total Issues</span>
                </div>
                {Object.entries(counts).map(([type, count]) => (
                    <div key={type} className="stat-item" style={{ borderColor: issueColor(type) }}>
                        <span className="stat-number" style={{ color: issueColor(type) }}>{count}</span>
                        <span className="stat-label">{issueIcon(type)} {type}</span>
                    </div>
                ))}
            </div>

            <div className="filter-bar">
                {["all", "pothole", "garbage", "streetlight", "other"].map((t) => (
                    <button
                        key={t}
                        className={`filter-chip ${filter === t ? "active" : ""}`}
                        onClick={() => setFilter(t)}
                        style={filter === t && t !== "all" ? { background: issueColor(t), borderColor: issueColor(t) } : {}}
                    >
                        {t === "all" ? "🗺️ All" : `${issueIcon(t)} ${t}`}
                    </button>
                ))}
            </div>

            <div className="map-wrapper">
                {loading ? (
                    <div className="map-loading">
                        <div className="spinner" />
                        <p>Loading issues…</p>
                    </div>
                ) : (
                    <MapView issues={filtered} />
                )}
            </div>
        </div>
    );
}
