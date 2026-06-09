import React, { useState, useEffect, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import IssueMarker from "../components/IssueMarker";
import HeroStatsPanel from "../components/HeroStatsPanel";
import FilterSelect from "../components/FilterSelect";
import IssueDetailModal from "../components/IssueDetailModal";
import { getAllIssues } from "../services/api";
import { issueIcon } from "../utils/helpers";
import { CITIES, ISSUE_TYPES, CityValue } from "../config/filters";
import { Issue } from "../types";

const cityOptions = CITIES.map((c) => ({
    value: c.value,
    label: c.label,
    icon: c.value === "all" ? "🌐" : "📍",
}));

const typeOptions = ISSUE_TYPES.map((t) => ({
    value: t.value,
    label: t.label,
    icon: t.value === "all" ? "🗺️" : issueIcon(t.value),
}));

export default function AdminIssues() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate("/map");
        }
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
                <HeroStatsPanel issues={issues} compact />
            </section>

            <div className="filter-toolbar" style={{ borderRadius: "var(--radius-lg)", marginBottom: "24px", border: "1px solid var(--border)" }}>
                <FilterSelect
                    label="City"
                    value={cityFilter}
                    onChange={(v) => setCityFilter(v as CityValue)}
                    options={cityOptions}
                />
                <FilterSelect
                    label="Issue Type"
                    value={typeFilter}
                    onChange={setTypeFilter}
                    options={typeOptions}
                />
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
                <div className="filter-result-badge">
                    {filtered.length} result{filtered.length !== 1 ? "s" : ""}
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
                        <IssueMarker
                            key={r.report_id || r.issue_id || r.id}
                            issue={r}
                            onClick={(issue) => setDetailId(issue.id)}
                        />
                    ))}
                </div>
            )}

            <IssueDetailModal issueId={detailId} onClose={() => setDetailId(null)} />
        </div>
    );
}
