import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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
    const bodyRef = useRef<HTMLDivElement>(null);
    const scrollLockRef = useRef(0);

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

        scrollLockRef.current = window.scrollY;
        const scrollY = scrollLockRef.current;
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.width = "100%";
        document.body.style.overflow = "hidden";

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleClose();
        };
        window.addEventListener("keydown", onKey);

        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.position = "";
            document.body.style.top = "";
            document.body.style.left = "";
            document.body.style.right = "";
            document.body.style.width = "";
            document.body.style.overflow = "";
            window.scrollTo(0, scrollY);
        };
    }, [issueId, handleClose]);

    useEffect(() => {
        if (issueId && bodyRef.current) {
            bodyRef.current.scrollTop = 0;
        }
    }, [issueId, detail]);

    if (!issueId) return null;

    const color = detail ? issueColor(detail.type) : "var(--accent)";
    const gmapsUrl = detail?.lat != null && detail?.lng != null
        ? `https://www.google.com/maps?q=${detail.lat},${detail.lng}`
        : null;

    const modal = (
        <div
            className="issue-detail-overlay"
            onClick={handleClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="issue-detail-title"
        >
            <div className="issue-detail-panel" onClick={(e) => e.stopPropagation()}>
                <header className="issue-detail-toolbar">
                    <button type="button" className="issue-detail-back" onClick={handleClose}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                            <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Back to map
                    </button>
                    <h2 id="issue-detail-title" className="issue-detail-title">
                        {detail ? `${issueIcon(detail.type)} Issue details` : "Issue details"}
                    </h2>
                    <button type="button" className="issue-detail-close" onClick={handleClose} aria-label="Close">
                        ×
                    </button>
                </header>

                <div className="issue-detail-body" ref={bodyRef}>
                    {loading ? (
                        <div className="issue-detail-loading">
                            <div className="spinner" />
                            <p>Loading report details…</p>
                        </div>
                    ) : error ? (
                        <div className="issue-detail-error">
                            <div className="alert alert-error">{error}</div>
                            <button type="button" className="btn-primary" onClick={handleClose}>
                                Go back
                            </button>
                        </div>
                    ) : detail ? (
                        <>
                            <div className="detail-header">
                                <div className="detail-header-badges">
                                    <span className="issue-type-badge" style={{ background: `${color}22`, color }}>
                                        {issueIcon(detail.type)} {detail.type}
                                    </span>
                                    <span className={`status-badge status-${detail.status}`}>{detail.status}</span>
                                    <span className="detail-city-tag">{detail.city}</span>
                                </div>
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

                <footer className="issue-detail-footer">
                    <button type="button" className="btn-outline issue-detail-footer-back" onClick={handleClose}>
                        ← Back to map
                    </button>
                </footer>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
