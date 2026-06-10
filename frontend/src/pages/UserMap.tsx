import React, { useState, useEffect, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { isClerkEnabled } from "../config/clerk";
import { useClerkSession } from "../hooks/useClerkSession";
import MapView from "../components/MapView";
import IssueDetailModal from "../components/IssueDetailModal";
import { getAllIssues } from "../services/api";
import FilterSelect from "../components/FilterSelect";
import MapLegend from "../components/MapLegend";
import { issueColor, filterWithinRadius, haversineM, normalizeIssueType } from "../utils/helpers";
import IssueTypeIcon from "../components/IssueTypeIcon";
import { CITIES, ISSUE_TYPES, CityValue } from "../config/filters";
import { Issue } from "../types";

const cityOptions = CITIES.map((c) => ({ value: c.value, label: c.label }));
const typeOptions = ISSUE_TYPES.map((t) => ({ value: t.value, label: t.label }));

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

    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [locating, setLocating] = useState(true);
    const [userPos, setUserPos] = useState<[number, number] | null>(null);
    const [cityFilter, setCityFilter] = useState<CityValue>("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [detailId, setDetailId] = useState<number | null>(null);
    const [geoError, setGeoError] = useState("");

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
        let result = filterWithinRadius(issues, userPos[0], userPos[1], RADIUS_M);
        if (cityFilter !== "all") {
            result = result.filter((i) => (i.city || "").toLowerCase() === cityFilter);
        }
        if (typeFilter !== "all") {
            result = result.filter((i) => normalizeIssueType(i.type) === typeFilter);
        }
        return result;
    }, [issues, userPos, cityFilter, typeFilter]);

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

    if (!user) return null;

    return (
        <div className="home-page user-map-page">
            <div className="user-map-header">
                <div>
                    <h1>Issues Near You</h1>
                    <p>
                        Showing civic issues within <strong>{RADIUS_M}m</strong> of your location
                        {userPos && !geoError && (
                            <span className="form-hint"> · {userPos[0].toFixed(4)}, {userPos[1].toFixed(4)}</span>
                        )}
                    </p>
                    {geoError && <div className="alert alert-error" style={{ marginTop: "12px" }}>{geoError}</div>}
                </div>
                <div className="user-map-badge">{nearbyIssues.length} nearby</div>
            </div>

            <div className="filter-toolbar">
                <FilterSelect
                    label="City"
                    value={cityFilter}
                    onChange={(v) => {
                        setCityFilter(v as CityValue);
                        setSelectedId(null);
                    }}
                    options={cityOptions}
                />
                <FilterSelect
                    label="Issue Type"
                    value={typeFilter}
                    onChange={(v) => {
                        setTypeFilter(v);
                        setSelectedId(null);
                    }}
                    options={typeOptions}
                />
                <div className="filter-result-badge">
                    {nearbyIssues.length} within {RADIUS_M}m
                </div>
            </div>

            <div className="map-layout user-map-layout">
                <div className="map-wrapper">
                    {loading || locating ? (
                        <div className="map-loading">
                            <div className="spinner" />
                            <p>{locating ? "Getting your location…" : "Loading issues…"}</p>
                        </div>
                    ) : userPos ? (
                        <>
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
                            <MapLegend
                                activeType={typeFilter}
                                onTypeSelect={(t) => {
                                    setTypeFilter((p) => (p === t ? "all" : t));
                                    setSelectedId(null);
                                }}
                            />
                        </>
                    ) : null}
                </div>

                <aside className="issue-sidebar">
                    <div className="sidebar-header">
                        <h3>Within {RADIUS_M}m</h3>
                        <span className="sidebar-count">{nearbyIssues.length} issue{nearbyIssues.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="issue-sidebar-list">
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
                                            <IssueTypeIcon type={issue.type} size={20} /> {issue.type}
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
                </aside>
            </div>

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
