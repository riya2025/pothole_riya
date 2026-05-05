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
}

export default function MapView({ issues = [], mapCenter = [17.385, 78.4867] }: MapViewProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markersRef = useRef<any>(null);

    useEffect(() => {
        if (mapInstanceRef.current || !mapRef.current) return;

        const map = L.map(mapRef.current, {
            center: mapCenter,
            zoom: 12,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors",
            maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;

        // @ts-ignore
        const mcg = L.markerClusterGroup ? L.markerClusterGroup() : L.layerGroup();
        markersRef.current = mcg;
        map.addLayer(mcg);
    }, []);

    // Effect to update map center when the `mapCenter` prop changes
    useEffect(() => {
        if (mapInstanceRef.current && mapCenter) {
            mapInstanceRef.current.setView(mapCenter, 12);
        }
    }, [mapCenter]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        const mcg = markersRef.current;
        if (!map || !mcg) return;

        mcg.clearLayers();

        issues.forEach((issue) => {
            if (!issue.lat || !issue.lng) return;

            const color = issueColor(issue.type);
            const icon = L.divIcon({
                html: `<div style="
          background:${color};
          width:32px;height:32px;border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);border:3px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
        ">
          <span style="transform:rotate(45deg);font-size:14px;">${issueIcon(issue.type)}</span>
        </div>`,
                className: "",
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -34],
            });

            const marker = L.marker([issue.lat, issue.lng], { icon });
            marker.bindPopup(`
        <div style="font-family:Inter,sans-serif;min-width:200px">
          <h3 style="margin:0 0 6px;color:${color};text-transform:capitalize;">${issueIcon(issue.type)} ${issue.type}</h3>
          <p style="margin:4px 0;font-size:13px;color:#555">${issue.address || "Unknown location"}</p>
          <div style="display:flex;gap:8px;margin-top:8px;font-size:12px;">
            <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:12px;">${issue.status}</span>
            <span style="background:#f0f0f0;padding:2px 8px;border-radius:12px;">📊 ${issue.report_count} report${issue.report_count !== 1 ? "s" : ""}</span>
          </div>
        </div>
      `);
            mcg.addLayer(marker);
        });
    }, [issues]);

    return <div ref={mapRef} id="map-container" style={{ height: "100%", width: "100%" }} />;
}
