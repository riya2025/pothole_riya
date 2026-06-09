import React, { useState, useEffect, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import IssueMarker from "../components/IssueMarker";
import { getAllIssues } from "../services/api";
import { issueIcon, issueColor } from "../utils/helpers";
import { Issue } from "../types";

export default function AdminIssues() {
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
    const [selectedIssue, setSelectedIssue] = useState<any>(null);

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
                    i.status?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [issues, filter, search]);

    const statusCounts = {
        active: issues.filter((i) => i.status === "active").length,
        resolved: issues.filter((i) => i.status === "resolved").length,
    };

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <h1>All Reported Issues</h1>
                <p>Browse civic issues reported across Hyderabad and Bangalore.</p>
            </div>

            <div className="stats-bar" style={{ position: "static", marginBottom: "24px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
                <div className="stat-item total">
                    <span className="stat-number">{issues.length}</span>
                    <span className="stat-label">Total</span>
                </div>
                <div className="stat-item mini" style={{ borderColor: issueColor("pothole") }}>
                    <span className="stat-number" style={{ color: issueColor("pothole") }}>
                        {issues.filter((i) => i.type === "pothole").length}
                    </span>
                    <span className="stat-label">{issueIcon("pothole")} Potholes</span>
                </div>
                <div className="stat-item mini" style={{ borderColor: "var(--success)" }}>
                    <span className="stat-number" style={{ color: "var(--success)" }}>{statusCounts.active}</span>
                    <span className="stat-label">Active</span>
                </div>
                <div className="stat-item mini" style={{ borderColor: "var(--accent)" }}>
                    <span className="stat-number" style={{ color: "var(--accent)" }}>{statusCounts.resolved}</span>
                    <span className="stat-label">Resolved</span>
                </div>
            </div>

            <div className="toolbar-row" style={{ borderRadius: "var(--radius-lg)", marginBottom: "24px", border: "1px solid var(--border)" }}>
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
                            onClick={(issue) => setSelectedIssue(issue)}
                        />
                    ))}
                </div>
            )}

            {selectedIssue && (
                <div className="modal-overlay" onClick={() => setSelectedIssue(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setSelectedIssue(null)}>×</button>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                            <span
                                className="issue-type-badge"
                                style={{
                                    background: `${issueColor(selectedIssue.type)}22`,
                                    color: issueColor(selectedIssue.type),
                                }}
                            >
                                {issueIcon(selectedIssue.type)} {selectedIssue.type}
                            </span>
                            <span className={`status-badge status-${selectedIssue.status}`}>
                                {selectedIssue.status}
                            </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <strong style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Location</strong>
                                <p style={{ marginTop: "6px" }}>{selectedIssue.address || "Unknown"}</p>
                            </div>
                            {selectedIssue.description && (
                                <div>
                                    <strong style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Description</strong>
                                    <p style={{ marginTop: "6px", color: "var(--text-secondary)" }}>{selectedIssue.description}</p>
                                </div>
                            )}
                            <div style={{ display: "flex", gap: "24px" }}>
                                <div>
                                    <strong style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Reports</strong>
                                    <p style={{ marginTop: "6px", fontSize: "20px", fontWeight: 800 }}>{selectedIssue.report_count}</p>
                                </div>
                                {selectedIssue.lat && selectedIssue.lng && (
                                    <div>
                                        <strong style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Coordinates</strong>
                                        <p style={{ marginTop: "6px", fontFamily: "monospace", fontSize: "13px" }}>
                                            {selectedIssue.lat.toFixed(5)}, {selectedIssue.lng.toFixed(5)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
