import React, { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { issueIcon, issueColor } from "../utils/helpers";
import { ReportSubmitResult } from "../types";

function buildTwitterShareUrl(text: string, url: string) {
    const params = new URLSearchParams({ text, url });
    return `https://twitter.com/intent/tweet?${params.toString()}`;
}

const TWEET_TEMPLATES: Record<string, { emoji: string; line: string; tags: string }> = {
    pothole: {
        emoji: "🕳️",
        line: "Just flagged a pothole before it claims another tyre.",
        tags: "#FixOurRoads #CivicWatch",
    },
    garbage: {
        emoji: "🗑️",
        line: "Just reported a garbage pile-up so our streets can breathe again.",
        tags: "#CleanCity #CivicWatch",
    },
    streetlight: {
        emoji: "💡",
        line: "Just reported a broken streetlight to keep our nights safe and bright.",
        tags: "#SaferStreets #CivicWatch",
    },
    other: {
        emoji: "📍",
        line: "Just reported a civic issue that needed someone to speak up.",
        tags: "#CivicWatch",
    },
};

function buildTweetText(type: string) {
    const t = TWEET_TEMPLATES[type] ?? TWEET_TEMPLATES.other;
    return (
        `${t.emoji} ${t.line}\n\n` +
        `Spotted something broken in your city? Snap it, drop a pin, and let's fix it together. ` +
        `Every report counts. 💪\n\n${t.tags}`
    );
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
        return buildTwitterShareUrl(buildTweetText(result.type), shareUrl);
    }, [result, shareUrl]);

    const mapsUrl =
        result?.latitude != null && result?.longitude != null
            ? `https://www.google.com/maps?q=${result.latitude},${result.longitude}`
            : null;

    const ghmcWhatsAppUrl = useMemo(() => {
        if (!result) return "";
        // GHMC's official civic-complaint WhatsApp number (override via env if needed).
        const number = process.env.REACT_APP_GHMC_WHATSAPP || "918125966586";
        const typeLabel: Record<string, string> = {
            pothole: "Pothole on the road",
            garbage: "Garbage / uncleared waste",
            streetlight: "Streetlight not working",
            other: "Civic issue",
        };
        const lines = ["GHMC Civic Complaint", `Issue: ${typeLabel[result.type] || "Civic issue"}`];
        if (result.address) lines.push(`Address: ${result.address}`);
        if (result.latitude != null && result.longitude != null) {
            lines.push(`Location: ${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}`);
            lines.push(`Map: https://www.google.com/maps?q=${result.latitude},${result.longitude}`);
        }
        if (result.image_url && /^https?:\/\//.test(result.image_url)) {
            lines.push(`Photo: ${result.image_url}`);
        }
        lines.push("", "Reported via CivicWatch — please also attach the photo from your gallery.");
        return `https://wa.me/${number}?text=${encodeURIComponent(lines.join("\n"))}`;
    }, [result]);

    if (!result?.issue_id) {
        return (
            <div className="report-success-page">
                <div className="report-success-card">
                    <h1>Nothing to show</h1>
                    <p className="form-hint">Submit a report first, or your session may have expired.</p>
                    <Link to="/map?report=1" className="btn-primary">Report an Issue</Link>
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
                </div>

                <div className="report-success-actions">
                    <a
                        href={ghmcWhatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-whatsapp btn-full"
                    >
                        Send to GHMC (WhatsApp)
                    </a>
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
                        onClick={() => navigate("/map?report=1")}
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
