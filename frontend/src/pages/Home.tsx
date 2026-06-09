import React, { useState, useEffect, useContext, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../App";
import MapView from "../components/MapView";
import { getAllIssues } from "../services/api";
import { issueIcon, issueColor } from "../utils/helpers";
import { Issue } from "../types";

export default function Home() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate("/dashboard");
        }
    }, [user, navigate]);

    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [mapCenter, setMapCenter] = useState<[number, number]>([17.385, 78.4867]);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    useEffect(() => {
        getAllIssues()
            .then((res) => setIssues(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        let result = filter === "all" ? issues : issues.filter((i) => i.type === filter);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (i) =>
                    i.address?.toLowerCase().includes(q) ||
                    i.type?.toLowerCase().includes(q) ||
                    i.city?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [issues, filter, search]);

    const cityStats = ["hyderabad", "bangalore"].map((city) => ({
        city,
        total: issues.filter((i) => i.city === city).length,
        pothole: issues.filter((i) => i.city === city && i.type === "pothole").length,
        streetlight: issues.filter((i) => i.city === city && i.type === "streetlight").length,
        garbage: issues.filter((i) => i.city === city && i.type === "garbage").length,
    }));

    const typeCounts = {
        pothole: issues.filter((i) => i.type === "pothole").length,
        garbage: issues.filter((i) => i.type === "garbage").length,
        streetlight: issues.filter((i) => i.type === "streetlight").length,
        other: issues.filter((i) => i.type === "other").length,
    };

    return (
        <div className="home-page">
            <section className="hero-section">
                <div className="hero-content">
                    <div className="hero-text">
                        <h1>
                            Spot it. <span>Report it.</span><br />
                            Fix your city.
                        </h1>
                        <p>
                            CivicWatch maps potholes, broken streetlights, and garbage across Hyderabad & Bangalore.
                            Join citizens making roads safer — one report at a time.
                        </p>
                        <div className="hero-actions">
                            <Link to="/register" className="btn-primary">Get Started Free</Link>
                            <Link to="/login" className="btn-outline">Sign In</Link>
                        </div>
                    </div>
                    <div className="hero-stats-preview">
                        <div className="hero-stat-pill">
                            <span className="stat-number">{issues.length}</span>
                            <span className="stat-label">Reports</span>
                        </div>
                        <div className="hero-stat-pill">
                            <span className="stat-number" style={{ color: issueColor("pothole") }}>
                                {typeCounts.pothole}
                            </span>
                            <span className="stat-label">{issueIcon("pothole")} Potholes</span>
                        </div>
                        <div className="hero-stat-pill">
                            <span className="stat-number" style={{ color: issueColor("streetlight") }}>
                                {typeCounts.streetlight}
                            </span>
                            <span className="stat-label">{issueIcon("streetlight")} Lights</span>
                        </div>
                    </div>
                </div>
            </section>

            <div className="stats-bar">
                <div className="stat-item total">
                    <span className="stat-number">{issues.length}</span>
                    <span className="stat-label">Total Reports</span>
                </div>
                {cityStats.map((cs) => (
                    <div key={cs.city} className="city-stats-group">
                        <div className="city-label">{cs.city === "hyderabad" ? "HYD" : "BLR"}</div>
                        <div className="city-counts">
                            <div className="stat-item mini" style={{ borderColor: "#a78bfa" }}>
                                <span className="stat-number" style={{ color: "#a78bfa" }}>{cs.total}</span>
                                <span className="stat-label">Total</span>
                            </div>
                            <div className="stat-item mini" style={{ borderColor: issueColor("pothole") }}>
                                <span className="stat-number" style={{ color: issueColor("pothole") }}>{cs.pothole}</span>
                                <span className="stat-label">{issueIcon("pothole")}</span>
                            </div>
                            <div className="stat-item mini" style={{ borderColor: issueColor("streetlight") }}>
                                <span className="stat-number" style={{ color: issueColor("streetlight") }}>{cs.streetlight}</span>
                                <span className="stat-label">{issueIcon("streetlight")}</span>
                            </div>
                            <div className="stat-item mini" style={{ borderColor: issueColor("garbage") }}>
                                <span className="stat-number" style={{ color: issueColor("garbage") }}>{cs.garbage}</span>
                                <span className="stat-label">{issueIcon("garbage")}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="toolbar-row">
                <span className="toolbar-label">Filter</span>
                {["all", "pothole", "garbage", "streetlight", "other"].map((t) => (
                    <button
                        key={t}
                        className={`filter-chip ${filter === t ? "active" : ""}`}
                        onClick={() => setFilter(t)}
                        style={filter === t && t !== "all" ? { background: issueColor(t), borderColor: issueColor(t) } : {}}
                    >
                        {t === "all" ? "All" : `${issueIcon(t)} ${t}`}
                    </button>
                ))}
                <div className="toolbar-divider" />
                <span className="toolbar-label">City</span>
                <button
                    className={`filter-chip ${mapCenter[0] === 17.385 ? "active" : ""}`}
                    onClick={() => setMapCenter([17.385, 78.4867])}
                >
                    Hyderabad
                </button>
                <button
                    className={`filter-chip ${mapCenter[0] === 12.9716 ? "active" : ""}`}
                    onClick={() => setMapCenter([12.9716, 77.5946])}
                >
                    Bangalore
                </button>
            </div>

            <div className="map-layout">
                <div className="map-wrapper">
                    {loading ? (
                        <div className="map-loading">
                            <div className="spinner" />
                            <p>Loading issues…</p>
                        </div>
                    ) : (
                        <>
                            <MapView
                                issues={filtered}
                                mapCenter={mapCenter}
                                selectedId={selectedId}
                                onMarkerClick={(issue) => setSelectedId(issue.id)}
                            />
                            <div className="map-legend">
                                <div className="map-legend-title">Issue Types</div>
                                {(["pothole", "garbage", "streetlight", "other"] as const).map((t) => (
                                    <div key={t} className="legend-item">
                                        <span className="legend-dot" style={{ background: issueColor(t), color: issueColor(t) }} />
                                        {issueIcon(t)} {t}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <aside className="issue-sidebar">
                    <div className="sidebar-header">
                        <h3>Nearby Issues</h3>
                        <span className="sidebar-count">{filtered.length} issue{filtered.length !== 1 ? "s" : ""} found</span>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search by address or type…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="issue-sidebar-list">
                        {loading ? (
                            <div className="loading-center"><div className="spinner" /></div>
                        ) : filtered.length === 0 ? (
                            <div className="empty-state" style={{ padding: "40px 20px", fontSize: "14px" }}>
                                <span>🔍</span>
                                <p>No issues match your search.</p>
                            </div>
                        ) : (
                            filtered.map((issue) => {
                                const color = issueColor(issue.type);
                                const isActive = selectedId === issue.id;
                                return (
                                    <div
                                        key={issue.id}
                                        className={`sidebar-issue-item ${isActive ? "active" : ""}`}
                                        style={{ borderLeftColor: isActive ? color : "transparent" }}
                                        onClick={() => {
                                            setSelectedId(issue.id);
                                            if (issue.lat && issue.lng) {
                                                setMapCenter([issue.lat, issue.lng]);
                                            }
                                        }}
                                    >
                                        <div className="sidebar-issue-type" style={{ color }}>
                                            {issueIcon(issue.type)} {issue.type}
                                        </div>
                                        <div className="sidebar-issue-address">
                                            {issue.address || "Unknown location"}
                                        </div>
                                        <div className="sidebar-issue-meta">
                                            <span>{issue.status}</span>
                                            <span>{issue.report_count} report{issue.report_count !== 1 ? "s" : ""}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
