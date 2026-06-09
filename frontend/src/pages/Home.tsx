import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import MapView from "../components/MapView";
import HeroStatsPanel from "../components/HeroStatsPanel";
import MapLegend from "../components/MapLegend";
import FilterSelect from "../components/FilterSelect";
import IssueDetailModal from "../components/IssueDetailModal";
import { getAllIssues } from "../services/api";
import { issueIcon, issueColor } from "../utils/helpers";
import { CITIES, CITY_CENTERS, ISSUE_TYPES, CityValue } from "../config/filters";
import { Issue } from "../types";

const cityOptions = CITIES.map((c) => ({
    value: c.value,
    label: c.label,
    icon: c.value === "hyderabad" ? "📍" : c.value === "bangalore" ? "📍" : "🌐",
}));

const typeOptions = ISSUE_TYPES.map((t) => ({
    value: t.value,
    label: t.label,
    icon: t.value === "all" ? "🗺️" : issueIcon(t.value),
}));

export default function Home() {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState("all");
    const [cityFilter, setCityFilter] = useState<CityValue>("all");
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
        setMapCenter(CITY_CENTERS[cityFilter] || CITY_CENTERS.all);
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
                    <HeroStatsPanel issues={issues} />
                </div>
            </section>

            <div className="filter-toolbar">
                <FilterSelect
                    label="City"
                    value={cityFilter}
                    onChange={(v) => setCityFilter(v as CityValue)}
                    options={cityOptions}
                    id="home-city-filter"
                />
                <FilterSelect
                    label="Issue Type"
                    value={typeFilter}
                    onChange={setTypeFilter}
                    options={typeOptions}
                    id="home-type-filter"
                />
                <div className="filter-search-group">
                    <label className="filter-select-label" htmlFor="home-search">Search</label>
                    <input
                        id="home-search"
                        type="text"
                        className="search-input filter-search-input"
                        placeholder="Address, type, city…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="filter-result-badge">
                    {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                </div>
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
                            <MapLegend />
                        </>
                    )}
                </div>

                <aside className="issue-sidebar">
                    <div className="sidebar-header">
                        <h3>Issues{cityFilter !== "all" ? ` in ${cityFilter}` : ""}</h3>
                        <span className="sidebar-count">{filtered.length} issue{filtered.length !== 1 ? "s" : ""}</span>
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
