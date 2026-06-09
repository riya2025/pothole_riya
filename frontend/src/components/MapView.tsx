import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { issueColor, issueIcon } from "../utils/helpers";
import { Issue } from "../types";

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
    onMarkerClick?: (issue: Issue) => void;
    onViewDetails?: (issue: Issue) => void;
}

export default function MapView({
    issues = [],
    mapCenter = [17.385, 78.4867],
    mapZoom = 12,
    selectedId = null,
    userPosition = null,
    showRadius,
    onMarkerClick,
    onViewDetails,
}: MapViewProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markersRef = useRef<any>(null);
    const markerMapRef = useRef<Map<number, L.Marker>>(new Map());
    const radiusRef = useRef<L.Circle | null>(null);
    const userMarkerRef = useRef<L.CircleMarker | null>(null);
    const onViewDetailsRef = useRef(onViewDetails);

    useEffect(() => {
        onViewDetailsRef.current = onViewDetails;
    }, [onViewDetails]);

    useEffect(() => {
        if (mapInstanceRef.current || !mapRef.current) return;

        const map = L.map(mapRef.current, {
            center: mapCenter,
            zoom: mapZoom,
            zoomControl: true,
        });

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
            attribution: '&copy; OSM &copy; CARTO',
            maxZoom: 19,
            subdomains: "abcd",
        }).addTo(map);

        mapInstanceRef.current = map;

        // @ts-ignore
        const mcg = L.markerClusterGroup ? L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
        }) : L.layerGroup();
        markersRef.current = mcg;
        map.addLayer(mcg);

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (mapInstanceRef.current && mapCenter) {
            mapInstanceRef.current.setView(mapCenter, mapZoom);
        }
    }, [mapCenter, mapZoom]);

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
        const map = mapInstanceRef.current;
        const mcg = markersRef.current;
        if (!map || !mcg) return;

        mcg.clearLayers();
        markerMapRef.current.clear();

        issues.forEach((issue) => {
            if (!issue.lat || !issue.lng) return;

            const color = issueColor(issue.type);
            const isSelected = selectedId === issue.id;
            const size = isSelected ? 40 : 32;

            const icon = L.divIcon({
                html: `<div style="
          background:${color};
          width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:3px solid #fff;
          box-shadow:0 ${isSelected ? "4px 16px" : "2px 8px"} ${isSelected ? color + "88" : "rgba(0,0,0,0.4)"};
          display:flex;align-items:center;justify-content:center;
        ">
          <span style="transform:rotate(45deg);font-size:${isSelected ? "16px" : "14px"};">${issueIcon(issue.type)}</span>
        </div>`,
                className: "",
                iconSize: [size, size],
                iconAnchor: [size / 2, size],
                popupAnchor: [0, -size - 2],
            });

            const marker = L.marker([issue.lat, issue.lng], { icon });
            const popupId = `popup-btn-${issue.id}`;
            marker.bindPopup(`
        <div style="font-family:Outfit,sans-serif;min-width:220px;padding:4px">
          <h3 style="margin:0 0 8px;color:${color};text-transform:capitalize;font-size:16px;font-weight:700;">
            ${issueIcon(issue.type)} ${issue.type}
          </h3>
          <p style="margin:0 0 10px;font-size:13px;color:#94A3B8;line-height:1.5;">${issue.address || "Unknown location"}</p>
          <div style="display:flex;gap:8px;font-size:12px;flex-wrap:wrap;margin-bottom:12px;">
            <span style="background:${color}22;color:${color};padding:4px 10px;border-radius:12px;font-weight:600;text-transform:capitalize;">${issue.status}</span>
            <span style="background:rgba(255,255,255,0.06);color:#94A3B8;padding:4px 10px;border-radius:12px;font-weight:600;">${issue.report_count} report${issue.report_count !== 1 ? "s" : ""}</span>
          </div>
          <button id="${popupId}" style="
            width:100%;padding:10px;border:none;border-radius:8px;
            background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;
            font-weight:700;font-size:13px;cursor:pointer;font-family:Outfit,sans-serif;
          ">View Full Details</button>
        </div>
      `);

            marker.on("popupopen", () => {
                const btn = document.getElementById(popupId);
                if (btn && onViewDetailsRef.current) {
                    btn.onclick = () => onViewDetailsRef.current!(issue);
                }
            });

            if (onMarkerClick) {
                marker.on("click", () => onMarkerClick(issue));
            }

            mcg.addLayer(marker);
            markerMapRef.current.set(issue.id, marker);
        });
    }, [issues, selectedId, onMarkerClick]);

    useEffect(() => {
        if (selectedId && markerMapRef.current.has(selectedId)) {
            const marker = markerMapRef.current.get(selectedId)!;
            marker.openPopup();
        }
    }, [selectedId]);

    return <div ref={mapRef} id="map-container" style={{ height: "100%", width: "100%" }} />;
}
