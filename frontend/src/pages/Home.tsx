import React, { useState, useEffect } from "react";
import MapView from "../components/MapView";
import { getAllIssues } from "../services/api";
import { issueIcon, issueColor } from "../utils/helpers";
import { Issue } from "../types";

export default function Home() {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    const [mapCenter, setMapCenter] = useState<[number, number]>([17.385, 78.4867]);

    useEffect(() => {
        getAllIssues()
            .then((res) => setIssues(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = filter === "all" ? issues : issues.filter((i) => i.type === filter);

    const cityStats = ["hyderabad", "bangalore"].map((city) => ({
        city,
        pothole: issues.filter((i) => i.city === city && i.type === "pothole").length,
        streetlight: issues.filter((i) => i.city === city && i.type === "streetlight").length,
        garbage: issues.filter((i) => i.city === city && i.type === "garbage").length,
    }));

    return (
        <div className="home-page">
            <div className="stats-bar">
                <div className="stat-item total">
                    <span className="stat-number">{issues.length}</span>
                    <span className="stat-label">Total Reports</span>
                </div>
                {cityStats.map((cs) => (
                    <div key={cs.city} className="city-stats-group">
                        <div className="city-label">{cs.city === "hyderabad" ? "📍 HYD" : "📍 BLR"}</div>
                        <div className="city-counts">
                            <div className="stat-item mini" style={{ borderColor: issueColor("pothole") }}>
                                <span className="stat-number" style={{ color: issueColor("pothole") }}>{cs.pothole}</span>
                                <span className="stat-label">{issueIcon("pothole")} Potholes</span>
                            </div>
                            <div className="stat-item mini" style={{ borderColor: issueColor("streetlight") }}>
                                <span className="stat-number" style={{ color: issueColor("streetlight") }}>{cs.streetlight}</span>
                                <span className="stat-label">{issueIcon("streetlight")} Streetlights</span>
                            </div>
                            <div className="stat-item mini" style={{ borderColor: issueColor("garbage") }}>
                                <span className="stat-number" style={{ color: issueColor("garbage") }}>{cs.garbage}</span>
                                <span className="stat-label">{issueIcon("garbage")} Garbage</span>
                            </div>
                        </div>
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

            <div className="filter-bar" style={{ marginTop: "10px" }}>
                <span style={{ fontSize: "14px", fontWeight: "bold", margin: "auto 10px auto 0" }}>City:</span>
                <button
                    className={`filter-chip ${mapCenter[0] === 17.385 ? "active" : ""}`}
                    onClick={() => setMapCenter([17.385, 78.4867])}
                >
                    📍 Hyderabad
                </button>
                <button
                    className={`filter-chip ${mapCenter[0] === 12.9716 ? "active" : ""}`}
                    onClick={() => setMapCenter([12.9716, 77.5946])}
                >
                    📍 Bangalore
                </button>
            </div>

            <div className="map-wrapper">
                {loading ? (
                    <div className="map-loading">
                        <div className="spinner" />
                        <p>Loading issues…</p>
                    </div>
                ) : (
                    <MapView issues={filtered} mapCenter={mapCenter} />
                )}
            </div>
        </div>
    );
}
