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

// City / state / district tokens that aren't useful as a neighbourhood filter.
const AREA_STOPWORDS = new Set([
    "india",
    "hyderabad",
    "bangalore",
    "bengaluru",
    "vijayawada",
    "telangana",
    "andhra pradesh",
    "karnataka",
    "ntr",
]);

/** Pull neighbourhood-level segments out of a full address string. */
function extractAreas(address?: string): string[] {
    if (!address) return [];
    return address
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => s.length > 2)
        .filter((s) => !/^\d[\d\s-]*$/.test(s)) // pincodes / numeric segments
        .filter((s) => !/\((urban|rural)\)/i.test(s))
        .filter((s) => !AREA_STOPWORDS.has(s.toLowerCase()));
}

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
    const [areaFilter, setAreaFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [detailId, setDetailId] = useState<number | null>(null);

    useEffect(() => {
        getAllIssues()
            .then((res) => setIssues(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    // Reset the area filter whenever the city changes (areas are city-specific).
    useEffect(() => {
        setAreaFilter("all");
    }, [cityFilter]);

    const cityIssues = useMemo(() => {
        if (cityFilter === "all") return issues;
        return issues.filter((i) => (i.city || "").toLowerCase() === cityFilter);
    }, [issues, cityFilter]);

    const areaOptions = useMemo(() => {
        const seen = new Map<string, string>();
        cityIssues.forEach((i) => {
            extractAreas(i.address).forEach((area) => {
                const key = area.toLowerCase();
                if (!seen.has(key)) seen.set(key, area);
            });
        });
        const sorted = Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
        return [
            { value: "all", label: "All Areas" },
            ...sorted.map(([key, label]) => ({ value: key, label })),
        ];
    }, [cityIssues]);

    const filtered = useMemo(() => {
        let result = cityIssues;
        if (areaFilter !== "all") {
            result = result.filter((i) => (i.address || "").toLowerCase().includes(areaFilter));
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
    }, [cityIssues, areaFilter, typeFilter, search]);

    return (
        <div className="dashboard-page">
            <section className="admin-hero">
                <div className="admin-hero-text">
                    <h1>All Reported Issues</h1>
                    <p>Browse civic issues reported across Hyderabad, Bangalore and Vijayawada.</p>
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
                <FilterSelect
                    label="Area"
                    value={areaFilter}
                    onChange={setAreaFilter}
                    options={areaOptions}
                />
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
