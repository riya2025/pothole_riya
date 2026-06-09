import React, { useState, useEffect, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import IssueMarker from "../components/IssueMarker";
import HeroVisualGallery from "../components/HeroVisualGallery";
import PlatformStatsBar from "../components/PlatformStatsBar";
import FilterSelect from "../components/FilterSelect";
import IssueDetailModal from "../components/IssueDetailModal";
import { getAllIssues } from "../services/api";
import { normalizeIssueType } from "../utils/helpers";
import { CITIES, ISSUE_TYPES, CityValue } from "../config/filters";
import { Issue } from "../types";

const cityOptions = CITIES.map((c) => ({ value: c.value, label: c.label }));
const typeOptions = ISSUE_TYPES.map((t) => ({ value: t.value, label: t.label }));

export default function AdminIssues() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) navigate("/map");
    }, [user, navigate]);

    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState("all");
    const [cityFilter, setCityFilter] = useState<CityValue>("all");
    const [search, setSearch] = useState("");
    const [detailId, setDetailId] = useState<number | null>(null);

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
                    i.status?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [issues, cityFilter, typeFilter, search]);

    return (
        <div className="dashboard-page">
            <section className="admin-hero">
                <div className="admin-hero-text">
                    <h1>All Reported Issues</h1>
                    <p>Browse civic issues reported across Hyderabad and Bangalore.</p>
                </div>
                <HeroVisualGallery
                    compact
                    activeType={typeFilter}
                    onTypeSelect={(t) => setTypeFilter((prev) => (prev === t ? "all" : t))}
                />
            </section>

            <PlatformStatsBar
                totalReports={issues.length}
                filteredCount={filtered.length}
                cityFilter={cityFilter}
            />

            <div className="filter-toolbar admin-filter-toolbar">
                <FilterSelect label="City" value={cityFilter} onChange={(v) => setCityFilter(v as CityValue)} options={cityOptions} />
                <FilterSelect label="Issue Type" value={typeFilter} onChange={setTypeFilter} options={typeOptions} />
                <div className="filter-search-group">
                    <label className="filter-select-label" htmlFor="admin-search">Search</label>
                    <input
                        id="admin-search"
                        type="text"
                        className="search-input filter-search-input"
                        placeholder="Search issues…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-center"><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <span>🗺️</span>
                    <p>No issues found matching your criteria.</p>
                </div>
            ) : (
                <div className="issues-grid">
                    {filtered.map((r: any) => (
                        <IssueMarker key={r.report_id || r.issue_id || r.id} issue={r} onClick={(issue) => setDetailId(issue.id)} />
                    ))}
                </div>
            )}

            <IssueDetailModal issueId={detailId} onClose={() => setDetailId(null)} />
        </div>
    );
}
