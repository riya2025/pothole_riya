import React from "react";
import { issueColor, formatDate } from "../utils/helpers";
import IssueTypeIcon from "./IssueTypeIcon";
import { Report } from "../types";

interface IssueMarkerProps {
    issue: any; // using any since it merges data for dashboard display
    onShare?: (issue: any) => void;
    onClick?: (issue: any) => void;
}

export default function IssueMarker({ issue, onShare, onClick }: IssueMarkerProps) {
    const color = issueColor(issue.type);

    return (
        <div className="issue-card"
            style={{ borderLeft: `4px solid ${color}`, cursor: onClick ? 'pointer' : 'default' }}
            onClick={() => onClick && onClick(issue)}>
            <div className="issue-card-header">
                <span className="issue-type-badge issue-type-badge-with-icon" style={{ background: `${color}22`, color }}>
                    <IssueTypeIcon type={issue.type} size={20} />
                    {issue.type}
                </span>
                <span className={`status-badge status-${issue.status}`}>{issue.status}</span>
            </div>
            <p className="issue-address">
                📍 {issue.address || (issue.latitude ? `${issue.latitude.toFixed(5)}, ${issue.longitude.toFixed(5)}` : "Unknown location")}
            </p>
            <div className="issue-meta">
                <span>📊 {issue.report_count} report{issue.report_count !== 1 ? "s" : ""}</span>
                <span>🕐 {formatDate(issue.created_at)}</span>
            </div>
            {onShare && (
                <button
                    className="btn-share"
                    onClick={() => onShare(issue)}
                    style={{ borderColor: color, color }}
                >
                    🐦 Share on Twitter
                </button>
            )}
        </div>
    );
}
