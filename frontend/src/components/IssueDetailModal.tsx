import React, { useEffect, useState, useCallback } from "react";
import { getIssueDetail } from "../services/api";
import { issueIcon, issueColor, formatDate, resolveMediaUrl } from "../utils/helpers";
import { IssueDetail } from "../types";

interface IssueDetailModalProps {
    issueId: number | null;
    onClose: () => void;
}

export default function IssueDetailModal({ issueId, onClose }: IssueDetailModalProps) {
    const [detail, setDetail] = useState<IssueDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleClose = useCallback(() => {
        setDetail(null);
        setError("");
        onClose();
    }, [onClose]);

    useEffect(() => {
        if (!issueId) {
            setDetail(null);
            return;
        }

        setLoading(true);
        setError("");
        getIssueDetail(issueId)
            .then((res) => setDetail(res.data))
            .catch(() => setError("Could not load issue details. Please try again."))
            .finally(() => setLoading(false));
    }, [issueId]);

    useEffect(() => {
        if (!issueId) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleClose();
        };
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", onKey);
        };
    }, [issueId, handleClose]);

    if (!issueId) return null;

    const color = detail ? issueColor(detail.type) : "var(--accent)";
    const gmapsUrl = detail?.lat != null && detail?.lng != null
        ? `https://www.google.com/maps?q=${detail.lat},${detail.lng}`
        : null;

    return (
        <div className="modal-overlay issue-detail-overlay" onClick={handleClose} role="dialog" aria-modal="true">
            <div className="modal-content modal-content-wide issue-detail-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={handleClose} aria-label="Close">×</button>

                {loading ? (
                    <div className="loading-center" style={{ padding: "48px" }}>
                        <div className="spinner" />
                        <p style={{ marginTop: "16px", color: "var(--text-secondary)" }}>Loading report details…</p>
                    </div>
                ) : error ? (
                    <div className="issue-detail-error">
                        <div className="alert alert-error">{error}</div>
                        <button type="button" className="btn-primary" onClick={handleClose}>Close</button>
                    </div>
                ) : detail ? (
                    <>
                        <div className="detail-header">
                            <div>
                                <span className="issue-type-badge" style={{ background: `${color}22`, color }}>
                                    {issueIcon(detail.type)} {detail.type}
                                </span>
                                <span className={`status-badge status-${detail.status}`}>{detail.status}</span>
                            </div>
                            <span className="detail-city-tag">{detail.city}</span>
                        </div>

                        <div className="detail-summary-cards">
                            <div className="detail-summary-card">
                                <span className="detail-summary-value">{detail.report_count}</span>
                                <span className="detail-summary-label">Total reports</span>
                            </div>
                            <div className="detail-summary-card">
                                <span className="detail-summary-value">{detail.reports.length}</span>
                                <span className="detail-summary-label">Submissions</span>
                            </div>
                            <div className="detail-summary-card">
                                <span className="detail-summary-value detail-summary-date">
                                    {formatDate(detail.created_at).split(",")[0]}
                                </span>
                                <span className="detail-summary-label">First reported</span>
                            </div>
                        </div>

                        <div className="detail-section detail-location-block">
                            <h4>Location</h4>
                            <p className="detail-address">{detail.address || "Address not available"}</p>
                            {detail.lat != null && detail.lng != null && (
                                <p className="detail-coords">
                                    {detail.lat.toFixed(5)}, {detail.lng.toFixed(5)}
                                </p>
                            )}
                            {gmapsUrl && (
                                <a
                                    href={gmapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-primary detail-gmaps-btn"
                                >
                                    Open in Google Maps
                                </a>
                            )}
                        </div>

                        <div className="detail-section">
                            <h4>Report history ({detail.reports.length})</h4>
                            {detail.reports.length === 0 ? (
                                <p className="form-hint">No individual submissions recorded for this issue yet.</p>
                            ) : (
                                <div className="report-timeline">
                                    {detail.reports.map((report, idx) => {
                                        const imgUrl = resolveMediaUrl(report.image_url);
                                        const reportMaps =
                                            report.latitude != null && report.longitude != null
                                                ? `https://www.google.com/maps?q=${report.latitude},${report.longitude}`
                                                : null;
                                        return (
                                            <div key={report.id} className="report-timeline-item">
                                                <div className="report-timeline-marker">{idx + 1}</div>
                                                <div className="report-timeline-body">
                                                    <div className="report-timeline-meta">
                                                        <span>{formatDate(report.created_at)}</span>
                                                        {reportMaps && (
                                                            <a href={reportMaps} target="_blank" rel="noopener noreferrer">
                                                                Pin on map
                                                            </a>
                                                        )}
                                                    </div>
                                                    {report.description ? (
                                                        <p className="report-timeline-desc">{report.description}</p>
                                                    ) : (
                                                        <p className="form-hint">No description provided.</p>
                                                    )}
                                                    {imgUrl && (
                                                        <a href={imgUrl} target="_blank" rel="noopener noreferrer">
                                                            <img src={imgUrl} alt="Report evidence" className="report-timeline-img" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}
