import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import MapView from "../components/MapView";
import HeroVisualGallery from "../components/HeroVisualGallery";
import PlatformStatsBar from "../components/PlatformStatsBar";
import MapLegend from "../components/MapLegend";
import FilterSelect from "../components/FilterSelect";
import IssueDetailModal from "../components/IssueDetailModal";
import { getAllIssues } from "../services/api";
import { issueColor, normalizeIssueType } from "../utils/helpers";
import IssueTypeIcon from "../components/IssueTypeIcon";
import { CITIES, CITY_CENTERS, CITY_ZOOM, ISSUE_TYPES, CityValue } from "../config/filters";
import { MapFocusPoint } from "../utils/helpers";
import { Issue } from "../types";
import { useAutoDetectCity } from "../hooks/useAutoDetectCity";

const cityOptions = CITIES.map((c) => ({ value: c.value, label: c.label }));
const typeOptions = ISSUE_TYPES.map((t) => ({ value: t.value, label: t.label }));

export default function Home() {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState("all");
    const [cityFilter, setCityFilter] = useState<CityValue>("all");
    const [search, setSearch] = useState("");
    const [focusPoint, setFocusPoint] = useState<MapFocusPoint | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [detailId, setDetailId] = useState<number | null>(null);

    const handleCityDetected = useCallback((city: CityValue) => {
        setCityFilter(city);
        setFocusPoint(null);
    }, []);

    const { detecting: detectingCity, detectedCity, markUserPicked } =
        useAutoDetectCity(handleCityDetected);

    useEffect(() => {
        getAllIssues()
            .then((res) => setIssues(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        let result = issues;
        if (cityFilter !== "all") {
            result = result.filter((i) => (i.city || "").toLowerCase() === cityFilter);
        }
        if (typeFilter !== "all") {
            result = result.filter((i) => normalizeIssueType(i.type) === typeFilter);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (i) =>
                    i.address?.toLowerCase().includes(q) ||
                    normalizeIssueType(i.type).includes(q) ||
                    i.city?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [issues, cityFilter, typeFilter, search]);

    useEffect(() => {
        if (selectedId && !filtered.some((i) => i.id === selectedId)) {
            setSelectedId(null);
        }
    }, [filtered, selectedId]);

    const clearMapFocus = () => setFocusPoint(null);

    const handleTypeSelect = (type: string) => {
        setTypeFilter((prev) => (prev === type ? "all" : type));
        setSelectedId(null);
        clearMapFocus();
    };

    const handleViewDetails = (issue: Issue) => {
        setSelectedId(issue.id);
        setDetailId(issue.id);
    };

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
                    <HeroVisualGallery activeType={typeFilter} onTypeSelect={handleTypeSelect} />
                </div>
            </section>

            <PlatformStatsBar
                totalReports={issues.length}
                filteredCount={filtered.length}
                cityFilter={cityFilter}
            />

            <div className="filter-toolbar">
                {detectingCity && (
                    <span className="filter-result-badge" style={{ alignSelf: "flex-end" }}>
                        Detecting your city…
                    </span>
                )}
                {!detectingCity && detectedCity && cityFilter === detectedCity && (
                    <span className="filter-result-badge" style={{ alignSelf: "flex-end" }}>
                        📍 {detectedCity.charAt(0).toUpperCase() + detectedCity.slice(1)} (from your location)
                    </span>
                )}
                <FilterSelect
                    label="City"
                    value={cityFilter}
                    onChange={(v) => {
                        markUserPicked();
                        setCityFilter(v as CityValue);
                        setSelectedId(null);
                        clearMapFocus();
                    }}
                    options={cityOptions}
                    id="home-city-filter"
                />
                <FilterSelect
                    label="Issue Type"
                    value={typeFilter}
                    onChange={(v) => {
                        setTypeFilter(v);
                        setSelectedId(null);
                        clearMapFocus();
                    }}
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
                        onChange={(e) => {
                            setSearch(e.target.value);
                            clearMapFocus();
                        }}
                    />
                </div>
                {(typeFilter !== "all" || cityFilter !== "all") && (
                    <button
                        type="button"
                        className="btn-outline filter-clear-btn"
                        onClick={() => {
                            markUserPicked();
                            setTypeFilter("all");
                            setCityFilter("all");
                            setSearch("");
                            setSelectedId(null);
                            clearMapFocus();
                        }}
                    >
                        Clear filters
                    </button>
                )}
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
                                autoFitBounds
                                fallbackCenter={CITY_CENTERS[cityFilter] || CITY_CENTERS.all}
                                fallbackZoom={CITY_ZOOM[cityFilter] ?? CITY_ZOOM.all}
                                maxFitZoom={cityFilter === "all" && typeFilter === "all" ? 10 : 15}
                                focusPoint={focusPoint}
                                selectedId={selectedId}
                                onMarkerClick={(issue) => setSelectedId(issue.id)}
                                onViewDetails={handleViewDetails}
                            />
                            <MapLegend activeType={typeFilter} onTypeSelect={handleTypeSelect} />
                        </>
                    )}
                </div>

                <aside className="issue-sidebar">
                    <div className="sidebar-header">
                        <h3>
                            {typeFilter !== "all"
                                ? `${typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)} issues`
                                : `Issues${cityFilter !== "all" ? ` in ${cityFilter}` : ""}`}
                        </h3>
                        <span className="sidebar-count">{filtered.length} shown</span>
                    </div>
                    <div className="issue-sidebar-list">
                        {loading ? (
                            <div className="loading-center"><div className="spinner" /></div>
                        ) : filtered.length === 0 ? (
                            <div className="empty-state sidebar-empty">
                                <span>🔍</span>
                                <p>No issues match your filters.</p>
                                <button
                                    type="button"
                                    className="btn-outline"
                                    onClick={() => {
                                        markUserPicked();
                                        setTypeFilter("all");
                                        setCityFilter("all");
                                        setSearch("");
                                        clearMapFocus();
                                    }}
                                >
                                    Reset filters
                                </button>
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
                                            if (issue.lat != null && issue.lng != null) {
                                                setFocusPoint({ lat: issue.lat, lng: issue.lng, zoom: 16 });
                                            }
                                        }}
                                    >
                                        <div className="sidebar-issue-type" style={{ color }}>
                                            <IssueTypeIcon type={issue.type} size={20} /> {issue.type}
                                        </div>
                                        <div className="sidebar-issue-address">
                                            {issue.address || "Unknown location"}
                                        </div>
                                        <div className="sidebar-issue-meta">
                                            <span>{issue.city}</span>
                                            <button
                                                type="button"
                                                className="sidebar-detail-link"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleViewDetails(issue);
                                                }}
                                            >
                                                View details
                                            </button>
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
