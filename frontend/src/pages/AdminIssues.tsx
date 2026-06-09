import React, { useState, useEffect, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import IssueMarker from "../components/IssueMarker";
import IssueVisualCards from "../components/IssueVisualCards";
import IssueDetailModal from "../components/IssueDetailModal";
import { getAllIssues } from "../services/api";
import { issueIcon, issueColor } from "../utils/helpers";
import { Issue } from "../types";

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
    const [cityFilter, setCityFilter] = useState<"all" | "hyderabad" | "bangalore">("all");
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
                <IssueVisualCards compact />
            </section>

            <div className="toolbar-row" style={{ borderRadius: "var(--radius-lg)", marginBottom: "24px", border: "1px solid var(--border)" }}>
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
                <div className="toolbar-divider" />
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search issues…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ maxWidth: "280px", flex: 1 }}
                />
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
