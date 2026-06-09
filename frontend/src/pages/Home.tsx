import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import MapView from "../components/MapView";
import IssueVisualCards from "../components/IssueVisualCards";
import IssueDetailModal from "../components/IssueDetailModal";
import { getAllIssues } from "../services/api";
import { issueIcon, issueColor } from "../utils/helpers";
import { Issue } from "../types";

const CITY_CENTERS: Record<string, [number, number]> = {
    all: [17.385, 78.4867],
    hyderabad: [17.385, 78.4867],
    bangalore: [12.9716, 77.5946],
};

export default function Home() {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState("all");
    const [cityFilter, setCityFilter] = useState<"all" | "hyderabad" | "bangalore">("all");
    const [search, setSearch] = useState("");
    const [mapCenter, setMapCenter] = useState<[number, number]>(CITY_CENTERS.all);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [detailId, setDetailId] = useState<number | null>(null);

    useEffect(() => {
        getAllIssues()
            .then((res) => setIssues(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        setMapCenter(CITY_CENTERS[cityFilter]);
    }, [cityFilter]);

    const filtered = useMemo(() => {
        let result = issues;
        if (cityFilter !== "all") {
            result = result.filter((i) => i.city === cityFilter);
        }
        if (typeFilter !== "all") {
            result = result.filter((i) => i.type === typeFilter);
        }
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
    }, [issues, cityFilter, typeFilter, search]);

    return (
        <div className="home-page">
            <section className="hero-section hero-with-visuals">
                <div className="hero-content hero-content-split">
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
                    <IssueVisualCards />
                </div>
            </section>

            <div className="toolbar-row">
                <span className="toolbar-label">City</span>
                {(["all", "hyderabad", "bangalore"] as const).map((c) => (
                    <button
                        key={c}
                        className={`filter-chip ${cityFilter === c ? "active" : ""}`}
                        onClick={() => setCityFilter(c)}
                    >
                        {c === "all" ? "All Cities" : c.charAt(0).toUpperCase() + c.slice(1)}
                    </button>
                ))}
                <div className="toolbar-divider" />
                <span className="toolbar-label">Type</span>
                {["all", "pothole", "garbage", "streetlight", "other"].map((t) => (
                    <button
                        key={t}
                        className={`filter-chip ${typeFilter === t ? "active" : ""}`}
                        onClick={() => setTypeFilter(t)}
                        style={typeFilter === t && t !== "all" ? { background: issueColor(t), borderColor: issueColor(t) } : {}}
                    >
                        {t === "all" ? "All" : `${issueIcon(t)} ${t}`}
                    </button>
                ))}
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
                                onViewDetails={(issue) => setDetailId(issue.id)}
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
                        <h3>Issues{cityFilter !== "all" ? ` in ${cityFilter}` : ""}</h3>
                        <span className="sidebar-count">{filtered.length} issue{filtered.length !== 1 ? "s" : ""}</span>
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
                                <p>No issues match your filters.</p>
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
                                            setDetailId(issue.id);
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
                                            <span>{issue.city}</span>
                                            <span>{issue.report_count} report{issue.report_count !== 1 ? "s" : ""}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>
            </div>

            <IssueDetailModal issueId={detailId} onClose={() => setDetailId(null)} />
        </div>
    );
}
