import React, { useEffect, useState } from "react";
import { getIssueDetail } from "../services/api";
import { issueIcon, issueColor, formatDate } from "../utils/helpers";
import { IssueDetail } from "../types";

interface IssueDetailModalProps {
    issueId: number | null;
    onClose: () => void;
}

export default function IssueDetailModal({ issueId, onClose }: IssueDetailModalProps) {
    const [detail, setDetail] = useState<IssueDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!issueId) {
            setDetail(null);
            return;
        }
        setLoading(true);
        setError("");
        getIssueDetail(issueId)
            .then((res) => setDetail(res.data))
            .catch(() => setError("Could not load issue details."))
            .finally(() => setLoading(false));
    }, [issueId]);

    if (!issueId) return null;

    const color = detail ? issueColor(detail.type) : "var(--accent)";
    const gmapsUrl = detail?.lat && detail?.lng
        ? `https://www.google.com/maps?q=${detail.lat},${detail.lng}`
        : null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content modal-content-wide" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>

                {loading ? (
                    <div className="loading-center"><div className="spinner" /></div>
                ) : error ? (
                    <div className="alert alert-error">{error}</div>
                ) : detail ? (
                    <>
                        <div className="detail-header">
                            <span className="issue-type-badge" style={{ background: `${color}22`, color }}>
                                {issueIcon(detail.type)} {detail.type}
                            </span>
                            <span className={`status-badge status-${detail.status}`}>{detail.status}</span>
                        </div>

                        <div className="detail-grid">
                            <div className="detail-section">
                                <h4>Location</h4>
                                <p>{detail.address || "Unknown address"}</p>
                                {gmapsUrl && (
                                    <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary detail-gmaps-btn">
                                        Open in Google Maps
                                    </a>
                                )}
                            </div>
                            <div className="detail-section">
                                <h4>Summary</h4>
                                <p><strong>{detail.report_count}</strong> total report{detail.report_count !== 1 ? "s" : ""}</p>
                                <p className="form-hint">First reported {formatDate(detail.created_at)}</p>
                            </div>
                        </div>

                        <div className="detail-section">
                            <h4>All Reports ({detail.reports.length})</h4>
                            {detail.reports.length === 0 ? (
                                <p className="form-hint">No individual report records available.</p>
                            ) : (
                                <div className="report-timeline">
                                    {detail.reports.map((report, idx) => (
                                        <div key={report.id} className="report-timeline-item">
                                            <div className="report-timeline-marker">{idx + 1}</div>
                                            <div className="report-timeline-body">
                                                <div className="report-timeline-meta">
                                                    <span>{formatDate(report.created_at)}</span>
                                                    {report.latitude && report.longitude && (
                                                        <a
                                                            href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            View on map
                                                        </a>
                                                    )}
                                                </div>
                                                {report.description && (
                                                    <p className="report-timeline-desc">{report.description}</p>
                                                )}
                                                {report.image_url && (
                                                    <img
                                                        src={report.image_url.startsWith("http") ? report.image_url : `${process.env.REACT_APP_API_URL || "http://localhost:8000"}${report.image_url}`}
                                                        alt="Report"
                                                        className="report-timeline-img"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}
