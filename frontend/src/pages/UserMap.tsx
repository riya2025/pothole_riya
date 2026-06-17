import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../App";
import { isClerkEnabled } from "../config/clerk";
import { useClerkSession } from "../hooks/useClerkSession";
import MapView from "../components/MapView";
import IssueDetailModal from "../components/IssueDetailModal";
import ReportIssueModal from "../components/ReportIssueModal";
import { getAllIssues } from "../services/api";
import { issueIcon, issueColor, filterWithinRadius, haversineM } from "../utils/helpers";
import { Issue } from "../types";

const RADIUS_M = 20;
const MAP_ZOOM = 18;

function UserMapContent({
    clerkLoaded,
    isSignedIn,
}: {
    clerkLoaded: boolean;
    isSignedIn: boolean;
}) {
    const { user, clerkSyncing } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [locating, setLocating] = useState(true);
    const [userPos, setUserPos] = useState<[number, number] | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [detailId, setDetailId] = useState<number | null>(null);
    const [geoError, setGeoError] = useState("");
    const [reportOpen, setReportOpen] = useState(searchParams.get("report") === "1");

    const openReport = useCallback(() => {
        setReportOpen(true);
        setSearchParams({ report: "1" }, { replace: true });
    }, [setSearchParams]);

    const closeReport = useCallback(() => {
        setReportOpen(false);
        if (searchParams.get("report")) {
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        setReportOpen(searchParams.get("report") === "1");
    }, [searchParams]);

    useEffect(() => {
        if (!isClerkEnabled) {
            if (!user) navigate("/login");
            return;
        }
        if (!clerkLoaded || clerkSyncing) return;
        if (!user && !isSignedIn) navigate("/login");
    }, [user, navigate, clerkLoaded, clerkSyncing, isSignedIn]);

    useEffect(() => {
        getAllIssues()
            .then((res) => setIssues(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!navigator.geolocation) {
            setGeoError("Geolocation is not supported.");
            setLocating(false);
            setUserPos([17.385, 78.4867]);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserPos([pos.coords.latitude, pos.coords.longitude]);
                setLocating(false);
            },
            () => {
                setGeoError("Could not get your location. Showing Hyderabad by default.");
                setUserPos([17.385, 78.4867]);
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, []);

    const nearbyIssues = useMemo(() => {
        if (!userPos) return [];
        return filterWithinRadius(issues, userPos[0], userPos[1], RADIUS_M);
    }, [issues, userPos]);

    if (isClerkEnabled && !user && clerkSyncing) {
        return (
            <div className="loading-center" style={{ minHeight: "60vh" }}>
                <div className="spinner" />
                <p style={{ marginTop: 12, color: "#94A3B8" }}>Connecting to server…</p>
            </div>
        );
    }

    if (isClerkEnabled && !user && !clerkLoaded) {
        return (
            <div className="loading-center" style={{ minHeight: "60vh" }}>
                <div className="spinner" />
                <p style={{ marginTop: 12, color: "#94A3B8" }}>Loading…</p>
            </div>
        );
    }

    if (!user) {
        // Signed in with Clerk, but the backend session sync failed (e.g. server
        // was cold-starting). Surface a retry instead of a blank screen.
        if (isClerkEnabled && isSignedIn) {
            return (
                <div className="server-retry">
                    <div className="server-retry-card">
                        <div className="server-retry-icon">
                            <div className="spinner" />
                        </div>
                        <h2 className="server-retry-title">Waking up the server…</h2>
                        <p className="server-retry-text">
                            We couldn't reach the server to finish signing you in. The backend may be
                            spinning up after a short rest — this usually takes a few seconds.
                        </p>
                        <button
                            type="button"
                            className="btn-primary server-retry-btn"
                            onClick={() => window.location.reload()}
                        >
                            Try again
                        </button>
                    </div>
                </div>
            );
        }
        return null;
    }

    return (
        <div className="home-page user-map-page">
            <div className="map-wrapper user-map-map-top">
                {loading || locating ? (
                    <div className="map-loading">
                        <div className="spinner" />
                        <p>{locating ? "Getting your location…" : "Loading issues…"}</p>
                    </div>
                ) : userPos ? (
                    <MapView
                        issues={nearbyIssues}
                        mapCenter={userPos}
                        mapZoom={MAP_ZOOM}
                        autoFitBounds
                        fallbackCenter={userPos}
                        fallbackZoom={MAP_ZOOM}
                        maxFitZoom={MAP_ZOOM}
                        selectedId={selectedId}
                        showRadius={RADIUS_M}
                        userPosition={userPos}
                        onMarkerClick={(issue) => setSelectedId(issue.id)}
                        onViewDetails={(issue) => setDetailId(issue.id)}
                    />
                ) : null}
            </div>

            <div className="user-map-panel">
                <div className="user-map-header">
                    <div>
                        <h1>Issues Near You</h1>
                        <p>
                            Auto-detected within <strong>{RADIUS_M}m</strong> of your location
                            {userPos && !geoError && (
                                <span className="form-hint"> · {userPos[0].toFixed(4)}, {userPos[1].toFixed(4)}</span>
                            )}
                        </p>
                        {geoError && <div className="alert alert-error" style={{ marginTop: "12px" }}>{geoError}</div>}
                    </div>
                    <div className="user-map-header-actions">
                        <div className="user-map-badge">{nearbyIssues.length} nearby</div>
                    </div>
                </div>

                <div className="user-map-issue-list">
                    {nearbyIssues.length === 0 ? (
                        <div className="empty-state" style={{ padding: "40px 20px", fontSize: "14px" }}>
                            <span>✅</span>
                            <p>No issues reported within {RADIUS_M}m of you.</p>
                        </div>
                    ) : (
                        nearbyIssues.map((issue) => {
                            const color = issueColor(issue.type);
                            const dist = userPos && issue.lat && issue.lng
                                ? haversineM(userPos[0], userPos[1], issue.lat, issue.lng)
                                : null;
                            return (
                                <div
                                    key={issue.id}
                                    className={`sidebar-issue-item ${selectedId === issue.id ? "active" : ""}`}
                                    style={{ borderLeftColor: selectedId === issue.id ? color : "transparent" }}
                                    onClick={() => {
                                        setSelectedId(issue.id);
                                        setDetailId(issue.id);
                                    }}
                                >
                                    <div className="sidebar-issue-type" style={{ color }}>
                                        {issueIcon(issue.type)} {issue.type}
                                    </div>
                                    <div className="sidebar-issue-address">{issue.address || "Unknown"}</div>
                                    <div className="sidebar-issue-meta">
                                        <span>{dist !== null ? `${Math.round(dist)}m away` : issue.status}</span>
                                        <span>{issue.report_count} reports</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <button
                type="button"
                className="report-fab"
                onClick={openReport}
                aria-label="Report an issue"
            >
                <span className="report-fab-icon">+</span>
                <span className="report-fab-label">Report</span>
            </button>

            <ReportIssueModal
                open={reportOpen}
                onClose={closeReport}
                initialCoords={userPos ? { lat: userPos[0], lng: userPos[1] } : null}
            />

            <IssueDetailModal issueId={detailId} onClose={() => setDetailId(null)} />
        </div>
    );
}

function UserMapWithClerk() {
    const { isSignedIn, isLoaded } = useClerkSession();
    return <UserMapContent clerkLoaded={isLoaded} isSignedIn={isSignedIn} />;
}

export default function UserMap() {
    if (isClerkEnabled) return <UserMapWithClerk />;
    return <UserMapContent clerkLoaded isSignedIn={false} />;
}
