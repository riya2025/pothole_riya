import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../App";
import { getUserIssues } from "../services/api";
import { issueColor, formatDate } from "../utils/helpers";
import IssueTypeIcon from "../components/IssueTypeIcon";
import { Issue } from "../types";

export default function MyReports() {
    const { user } = useContext(AuthContext);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            getUserIssues(user.id)
                .then((res) => setIssues(res.data))
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [user]);

    const getProgress = (status: string) => {
        if (status === 'resolved') return 100;
        if (status === 'active') return 50;
        return 10; // pending/reported
    };

    return (
        <div className="dashboard-page">
            <div className="dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                <div>
                    <h1>My Civic Reports</h1>
                    <p>Track the status and progress of the issues you have reported.</p>
                </div>
                <Link to="/dashboard" className="btn-primary">+ Report New Issue</Link>
            </div>

            {loading ? (
                <div className="loading-center"><div className="spinner" /></div>
            ) : issues.length === 0 ? (
                <div className="empty-state">
                    <span>✨</span>
                    <p>You haven't reported any issues yet.</p>
                    <Link to="/dashboard" className="btn-primary">Report Your First Issue</Link>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {issues.map((issue: any) => {
                        const progress = getProgress(issue.status);
                        const color = issueColor(issue.type);

                        return (
                            <div key={issue.report_id || issue.id} className="issue-row">
                                <div className="issue-row-header">
                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        <span className="issue-type-badge issue-type-badge-with-icon" style={{ background: `${color}22`, color }}>
                                            <IssueTypeIcon type={issue.type} size={20} />
                                            {issue.type}
                                        </span>
                                        <span className="issue-address">📍 {issue.address || "Location Tracking..."}</span>
                                    </div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {formatDate(issue.created_at)}
                                    </span>
                                </div>
                                <div className="issue-progress-container">
                                    <div className="progress-track">
                                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                                    </div>
                                    <div className="progress-steps">
                                        <span className={`progress-step ${progress >= 10 ? 'active' : ''}`}>Reported</span>
                                        <span className={`progress-step ${progress >= 50 ? 'active' : ''}`}>In Progress</span>
                                        <span className={`progress-step ${progress >= 100 ? 'active' : ''}`}>Resolved</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
