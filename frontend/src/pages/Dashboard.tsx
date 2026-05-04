import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../App";
import { getUserIssues, generateShare } from "../services/api";
import IssueMarker from "../components/IssueMarker";
import { buildTweetUrl } from "../utils/helpers";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
    const { user } = useContext(AuthContext);
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) { navigate("/login"); return; }
        getUserIssues(user.id)
            .then((res) => setReports(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [user, navigate]);

    const handleShare = async (issue: any) => {
        try {
            const res = await generateShare(issue.issue_id, issue.type, issue.address || "Unknown location");
            window.open(buildTweetUrl(res.data.tweet_text), "_blank");
        } catch {
            window.open(
                buildTweetUrl(`🚨 Civic issue (${issue.type}) at ${issue.address}! #CivicWatch`),
                "_blank"
            );
        }
    };

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <h1>📋 My Reports</h1>
                <p>Track all the civic issues you've reported.</p>
            </div>

            {loading ? (
                <div className="loading-center"><div className="spinner" /></div>
            ) : reports.length === 0 ? (
                <div className="empty-state">
                    <span>🗺️</span>
                    <p>You haven't reported any issues yet.</p>
                    <button className="btn-primary" onClick={() => navigate("/report")}>
                        Report an Issue
                    </button>
                </div>
            ) : (
                <div className="issues-grid">
                    {reports.map((r) => (
                        <IssueMarker key={r.report_id} issue={r} onShare={handleShare} />
                    ))}
                </div>
            )}
        </div>
    );
}
