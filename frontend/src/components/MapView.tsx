import React, { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import {
    issueColor,
    issueIcon,
    issueImageUrl,
    issueMarkerInnerHtml,
    issuesWithCoords,
    MapFocusPoint,
} from "../utils/helpers";
import { MAP_TILE_OPTIONS, MAP_TILE_URL } from "../config/map";
import { Issue } from "../types";

function createMarkerGroup(): L.MarkerClusterGroup | L.LayerGroup {
    if (typeof (L as typeof L & { markerClusterGroup?: typeof L.markerClusterGroup }).markerClusterGroup === "function") {
        return L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
        });
    }
    return L.layerGroup();
}

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface MapViewProps {
    issues?: Issue[];
    mapCenter?: [number, number];
    mapZoom?: number;
    selectedId?: number | null;
    userPosition?: [number, number] | null;
    showRadius?: number;
    /** Pan/zoom to filtered markers when filters change */
    autoFitBounds?: boolean;
    fallbackCenter?: [number, number];
    fallbackZoom?: number;
    focusPoint?: MapFocusPoint | null;
    maxFitZoom?: number;
    onMarkerClick?: (issue: Issue) => void;
    onViewDetails?: (issue: Issue) => void;
}

function buildMarkerIcon(issue: Issue, isSelected: boolean) {
    const color = issueColor(issue.type);
    const size = isSelected ? 40 : 32;
    return L.divIcon({
        html: `<div style="
      background:${color};
      width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:3px solid #fff;
      box-shadow:0 ${isSelected ? "6px 18px" : "3px 10px"} ${isSelected ? color + "55" : "rgba(15,23,42,0.28)"};
      display:flex;align-items:center;justify-content:center;
    ">
      ${issueMarkerInnerHtml(issue.type, isSelected ? 18 : 14)}
    </div>`,
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size - 2],
    });
}

function buildPopupHtml(issue: Issue) {
    const color = issueColor(issue.type);
    const thumb = issueImageUrl(issue.type);
    const titleIcon = thumb
        ? `<img src="${thumb}" alt="" style="width:28px;height:28px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:8px;" />`
        : `${issueIcon(issue.type)} `;
    return `
    <div class="leaflet-popup-inner" style="font-family:Outfit,sans-serif;min-width:240px;padding:4px">
      <h3 style="margin:0 0 8px;color:${color};text-transform:capitalize;font-size:16px;font-weight:700;display:flex;align-items:center;">
        ${titleIcon}<span>${issue.type}</span>
      </h3>
      <p style="margin:0 0 10px;font-size:13px;color:#475569;line-height:1.5;">${issue.address || "Unknown location"}</p>
      <div style="display:flex;gap:8px;font-size:12px;flex-wrap:wrap;margin-bottom:12px;">
        <span style="background:${color}18;color:${color};padding:4px 10px;border-radius:12px;font-weight:600;text-transform:capitalize;">${issue.status}</span>
        <span style="background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:12px;font-weight:600;">${issue.report_count} report${issue.report_count !== 1 ? "s" : ""}</span>
      </div>
      <button type="button" class="map-detail-btn" data-issue-id="${issue.id}" style="
        width:100%;padding:10px;border:none;border-radius:8px;
        background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;
        font-weight:700;font-size:13px;cursor:pointer;font-family:Outfit,sans-serif;
      ">View Full Details</button>
    </div>
  `;
}

export default function MapView({
    issues = [],
    mapCenter = [17.385, 78.4867],
    mapZoom = 12,
    selectedId = null,
    userPosition = null,
    showRadius,
    autoFitBounds = false,
    fallbackCenter,
    fallbackZoom = 12,
    focusPoint = null,
    maxFitZoom = 15,
    onMarkerClick,
    onViewDetails,
}: MapViewProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markersRef = useRef<any>(null);
    const markerMapRef = useRef<Map<number, L.Marker>>(new Map());
    const radiusRef = useRef<L.Circle | null>(null);
    const userMarkerRef = useRef<L.CircleMarker | null>(null);
    const issuesRef = useRef(issues);
    const selectedIdRef = useRef(selectedId);
    const onMarkerClickRef = useRef(onMarkerClick);
    const onViewDetailsRef = useRef(onViewDetails);

    issuesRef.current = issues;
    selectedIdRef.current = selectedId;
    onMarkerClickRef.current = onMarkerClick;
    onViewDetailsRef.current = onViewDetails;

    const openIssueDetails = useCallback((issueId: number) => {
        const issue = issuesRef.current.find((i) => i.id === issueId);
        if (!issue) return;
        mapInstanceRef.current?.closePopup();
        requestAnimationFrame(() => {
            onViewDetailsRef.current?.(issue);
        });
    }, []);

    useEffect(() => {
        if (mapInstanceRef.current || !mapRef.current) return;

        const map = L.map(mapRef.current, {
            center: mapCenter,
            zoom: mapZoom,
            zoomControl: true,
        });

        L.tileLayer(MAP_TILE_URL, MAP_TILE_OPTIONS).addTo(map);

        mapInstanceRef.current = map;

        const mcg = createMarkerGroup();
        markersRef.current = mcg;
        map.addLayer(mcg);

        const handleMapClick = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest(".map-detail-btn");
            if (!target) return;
            e.preventDefault();
            e.stopPropagation();
            const id = Number((target as HTMLElement).dataset.issueId);
            if (!Number.isNaN(id)) openIssueDetails(id);
        };

        map.getContainer().addEventListener("click", handleMapClick);

        return () => {
            map.getContainer().removeEventListener("click", handleMapClick);
            map.remove();
            mapInstanceRef.current = null;
        };
    }, [openIssueDetails]);

    useEffect(() => {
        if (autoFitBounds) return;
        if (mapInstanceRef.current && mapCenter) {
            mapInstanceRef.current.setView(mapCenter, mapZoom);
        }
    }, [mapCenter, mapZoom, autoFitBounds]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        if (focusPoint) {
            map.flyTo([focusPoint.lat, focusPoint.lng], focusPoint.zoom ?? 16, { duration: 0.7 });
            return;
        }

        if (!autoFitBounds) return;

        const coords = issuesWithCoords(issues);
        const center = fallbackCenter ?? mapCenter;
        const zoom = fallbackZoom ?? mapZoom;
        const fitPoints: [number, number][] = coords.map(
            (i) => [i.lat!, i.lng!] as [number, number]
        );
        if (userPosition) {
            fitPoints.push(userPosition);
        }

        if (fitPoints.length === 0) {
            map.flyTo(center, zoom, { duration: 0.7 });
            return;
        }

        if (fitPoints.length === 1) {
            map.flyTo(fitPoints[0], Math.min(maxFitZoom, 16), { duration: 0.7 });
            return;
        }

        const bounds = L.latLngBounds(fitPoints);
        map.flyToBounds(bounds, {
            padding: [60, 60],
            maxZoom: maxFitZoom,
            duration: 0.7,
        });
    }, [
        issues,
        autoFitBounds,
        fallbackCenter,
        fallbackZoom,
        focusPoint,
        mapCenter,
        mapZoom,
        maxFitZoom,
        userPosition,
    ]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        if (radiusRef.current) {
            map.removeLayer(radiusRef.current);
            radiusRef.current = null;
        }
        if (userMarkerRef.current) {
            map.removeLayer(userMarkerRef.current);
            userMarkerRef.current = null;
        }

        if (userPosition) {
            userMarkerRef.current = L.circleMarker(userPosition, {
                radius: 8,
                color: "#818cf8",
                fillColor: "#818cf8",
                fillOpacity: 0.9,
                weight: 3,
            }).addTo(map).bindPopup("You are here");

            if (showRadius) {
                radiusRef.current = L.circle(userPosition, {
                    radius: showRadius,
                    color: "#818cf8",
                    fillColor: "#818cf8",
                    fillOpacity: 0.08,
                    weight: 2,
                    dashArray: "6 4",
                }).addTo(map);
            }
        }
    }, [userPosition, showRadius]);

    useEffect(() => {
        const mcg = markersRef.current;
        if (!mcg) return;

        mcg.clearLayers();
        markerMapRef.current.clear();

        issues.forEach((issue) => {
            if (issue.lat == null || issue.lng == null) return;

            const isSelected = selectedIdRef.current === issue.id;
            const marker = L.marker([issue.lat, issue.lng], {
                icon: buildMarkerIcon(issue, isSelected),
            });

            marker.bindPopup(buildPopupHtml(issue));

            marker.on("click", () => {
                onMarkerClickRef.current?.(issue);
            });

            mcg.addLayer(marker);
            markerMapRef.current.set(issue.id, marker);
        });
    }, [issues]);

    useEffect(() => {
        markerMapRef.current.forEach((marker, id) => {
            const issue = issuesRef.current.find((i) => i.id === id);
            if (!issue) return;
            const isSelected = selectedId === id;
            marker.setIcon(buildMarkerIcon(issue, isSelected));
        });

        if (selectedId && markerMapRef.current.has(selectedId)) {
            const marker = markerMapRef.current.get(selectedId)!;
            marker.openPopup();
        }
    }, [selectedId]);

    return <div ref={mapRef} id="map-container" style={{ height: "100%", width: "100%" }} />;
}
