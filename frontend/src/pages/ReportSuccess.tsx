import React, { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { issueIcon, issueColor } from "../utils/helpers";
import { ReportSubmitResult } from "../types";

function buildTwitterShareUrl(text: string, url: string) {
    const params = new URLSearchParams({ text, url });
    return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export default function ReportSuccess() {
    const location = useLocation();
    const navigate = useNavigate();
    const result = location.state as ReportSubmitResult | null;

    const shareUrl = useMemo(() => {
        if (!result) return "";
        const site = process.env.REACT_APP_SITE_URL || window.location.origin;
        return `${site.replace(/\/$/, "")}/map`;
    }, [result]);

    const twitterUrl = useMemo(() => {
        if (!result) return "";
        const typeLabel = result.type.charAt(0).toUpperCase() + result.type.slice(1);
        const locationBit = result.address ? ` near ${result.address}` : "";
        const text =
            `I just reported a ${typeLabel.toLowerCase()} issue${locationBit} on CivicWatch. ` +
            `Help make our city safer — report civic problems near you! #CivicWatch`;
        return buildTwitterShareUrl(text, shareUrl);
    }, [result, shareUrl]);

    const mapsUrl =
        result?.latitude != null && result?.longitude != null
            ? `https://www.google.com/maps?q=${result.latitude},${result.longitude}`
            : null;

    if (!result?.issue_id) {
        return (
            <div className="report-success-page">
                <div className="report-success-card">
                    <h1>Nothing to show</h1>
                    <p className="form-hint">Submit a report first, or your session may have expired.</p>
                    <Link to="/dashboard" className="btn-primary">Report an Issue</Link>
                </div>
            </div>
        );
    }

    const color = issueColor(result.type);
    const isNew = result.status === "created";

    return (
        <div className="report-success-page">
            <div className="report-success-card">
                <div className="report-success-icon" style={{ background: `${color}22`, color }}>
                    {issueIcon(result.type)}
                </div>
                <h1>{isNew ? "Report submitted!" : "Report added!"}</h1>
                <p className="report-success-lead">
                    {isNew
                        ? "Your civic issue has been logged and classified."
                        : "Your report was linked to an existing issue at the same location."}
                </p>

                <div className="report-success-details">
                    <div className="report-success-row">
                        <span className="report-success-label">Type</span>
                        <span style={{ color, fontWeight: 700 }}>
                            {issueIcon(result.type)} {result.type}
                        </span>
                    </div>
                    {result.address && (
                        <div className="report-success-row">
                            <span className="report-success-label">Location</span>
                            <span>{result.address}</span>
                        </div>
                    )}
                    {result.classification_source && (
                        <div className="report-success-row">
                            <span className="report-success-label">Classified by</span>
                            <span>
                                {result.classification_source === "groq" ? "Groq AI" : "Keyword matching"}
                            </span>
                        </div>
                    )}
                    <div className="report-success-row">
                        <span className="report-success-label">Issue ID</span>
                        <span>#{result.issue_id}</span>
                    </div>
                </div>

                <div className="report-success-actions">
                    <a
                        href={twitterUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-twitter btn-full"
                    >
                        Share on X (Twitter)
                    </a>
                    {mapsUrl && (
                        <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-outline btn-full"
                        >
                            View on Google Maps
                        </a>
                    )}
                    <button
                        type="button"
                        className="btn-primary btn-full"
                        onClick={() => navigate("/dashboard")}
                    >
                        Report Another Issue
                    </button>
                    <Link to="/map" className="btn-secondary btn-full" style={{ textAlign: "center" }}>
                        See Issues Near Me
                    </Link>
                </div>
            </div>
        </div>
    );
}
