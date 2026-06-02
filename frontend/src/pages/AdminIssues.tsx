import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import IssueMarker from "../components/IssueMarker";
import { getAllIssues } from "../services/api";
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
    const [selectedIssue, setSelectedIssue] = useState<any>(null);

    useEffect(() => {
        getAllIssues()
            .then((res) => setIssues(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = filter === "all" ? issues : issues.filter((i) => i.type === filter);

    return (
        <div className="dashboard-page">
            <div className="dashboard-header" style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '20px' }}>
                <h1>📋 All Reported Issues (Admin)</h1>
                <p>Browse through all the civic issues reported across the city.</p>
            </div>

            {loading ? (
                <div className="loading-center"><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <span>🗺️</span>
                    <p>No issues found matching the criteria.</p>
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
                        <h2 style={{ marginBottom: '16px', fontSize: '24px', fontWeight: 800 }}>Issue Details</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <strong style={{ color: 'var(--text-secondary)' }}>Type:</strong> <br />
                                <span style={{ textTransform: 'capitalize' }}>{selectedIssue.type}</span>
                            </div>
                            <div>
                                <strong style={{ color: 'var(--text-secondary)' }}>Status:</strong> <br />
                                <span style={{ textTransform: 'capitalize' }}>{selectedIssue.status}</span>
                            </div>
                            <div>
                                <strong style={{ color: 'var(--text-secondary)' }}>Location:</strong> <br />
                                <span>{selectedIssue.address || "Unknown"}</span>
                            </div>
                            {selectedIssue.description && (
                                <div>
                                    <strong style={{ color: 'var(--text-secondary)' }}>Description:</strong> <br />
                                    <span>{selectedIssue.description}</span>
                                </div>
                            )}
                            <div>
                                <strong style={{ color: 'var(--text-secondary)' }}>Report Count:</strong> <br />
                                <span>{selectedIssue.report_count}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
