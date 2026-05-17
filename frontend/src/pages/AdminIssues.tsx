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

    useEffect(() => {
        getAllIssues()
            .then((res) => setIssues(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = filter === "all" ? issues : issues.filter((i) => i.type === filter);

    return (
        <div className="home-page">
            <div className="dashboard-header" style={{ borderTop: '1px solid #ddd', padding: '40px 32px 20px', marginTop: '20px' }}>
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
                <div className="issues-grid" style={{ padding: '0 32px', paddingBottom: '40px' }}>
                    {filtered.map((r: any) => (
                        <IssueMarker key={r.report_id || r.issue_id || r.id} issue={r} />
                    ))}
                </div>
            )}
        </div>
    );
}
