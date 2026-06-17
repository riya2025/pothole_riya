import React, { useState, ChangeEvent, FormEvent, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { reportIssue } from "../services/api";
import { ReportSubmitResult } from "../types";
import exifr from 'exifr';
import L from "leaflet";
import { MAP_TILE_OPTIONS, MAP_TILE_URL } from "../config/map";

interface ReportFormProps {
    onSuccess?: (data: any) => void;
    variant?: "page" | "modal";
    initialCoords?: { lat: number; lng: number };
    skipAutoGps?: boolean;
}

export default function ReportForm({
    onSuccess,
    variant = "page",
    initialCoords,
    skipAutoGps = false,
}: ReportFormProps) {
    const navigate = useNavigate();
    const [description, setDescription] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false);
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [error, setError] = useState("");
    const [dragOver, setDragOver] = useState(false);
    const [locStatus, setLocStatus] = useState<{ type: "info" | "success" | "warn"; text: string } | null>(null);

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const mapReadyRef = useRef(false);

    const applyCoordsToMap = (lat: number, lng: number, zoom = 16) => {
        const map = mapInstanceRef.current;
        const marker = markerRef.current;
        if (!map || !marker) return;
        marker.setLatLng([lat, lng]);
        map.setView([lat, lng], zoom, { animate: true });
    };

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        const defaultCenter: [number, number] = [17.385, 78.4867];
        const map = L.map(mapRef.current).setView(defaultCenter, 6);

        L.tileLayer(MAP_TILE_URL, MAP_TILE_OPTIONS).addTo(map);

        const marker = L.marker(defaultCenter, { draggable: true, opacity: 0.35 }).addTo(map);
        marker.on("dragend", () => {
            const position = marker.getLatLng();
            marker.setOpacity(1);
            setCoords({ lat: position.lat, lng: position.lng });
            setLocStatus({ type: "info", text: "Location set manually on the map." });
        });

        map.on("click", (e) => {
            marker.setLatLng(e.latlng);
            marker.setOpacity(1);
            setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
            setLocStatus({ type: "info", text: "Location set manually on the map." });
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
        mapReadyRef.current = true;

        return () => {
            map.remove();
            mapInstanceRef.current = null;
            markerRef.current = null;
            mapReadyRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (coords) {
            applyCoordsToMap(coords.lat, coords.lng);
            markerRef.current?.setOpacity(1);
        }
    }, [coords]);

    useEffect(() => {
        if (initialCoords) {
            setCoords(initialCoords);
            return;
        }
        if (!skipAutoGps) {
            getLocation();
        }
    }, [initialCoords, skipAutoGps]);

    const processImage = async (file: File) => {
        setImage(file);
        setImagePreview(URL.createObjectURL(file));

        try {
            const gps = await exifr.gps(file);
            const lat = gps?.latitude;
            const lng = gps?.longitude;
            if (typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng)) {
                setCoords({ lat, lng });
                setError("");
                setLocStatus({ type: "success", text: "Location detected from photo." });
                return;
            }
        } catch {
            /* fall through to the no-GPS message */
        }

        setLocStatus({
            type: "warn",
            text: "No GPS data in this photo — use “Use My Current Location” or tap the map to set the spot.",
        });
    };

    const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processImage(file);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file?.type.startsWith("image/")) await processImage(file);
    };

    const getLocation = () => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported. Click the map or paste a Google Maps link.");
            return;
        }
        setLocating(true);
        setError("");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocStatus({ type: "success", text: "Location captured from your device GPS." });
                setLocating(false);
            },
            () => {
                setError("Could not get your location. Allow GPS, or click the map / paste a Google Maps link.");
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!coords) {
            setError("Set the issue location first — use GPS, click the map, or paste a Google Maps link.");
            return;
        }
        if (!description.trim()) { setError("Please add a description."); return; }

        setLoading(true);
        setError("");
        try {
            const formData = new FormData();
            formData.append("description", description);
            formData.append("latitude", coords.lat.toString());
            formData.append("longitude", coords.lng.toString());
            if (image) formData.append("image", image);

            const res = await reportIssue(formData);
            const payload: ReportSubmitResult = {
                ...res.data,
                description: description.trim(),
                latitude: coords.lat,
                longitude: coords.lng,
            };
            if (onSuccess) onSuccess(payload);
            navigate("/report/success", { state: payload, replace: true });
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to submit report.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className={`report-form ${variant === "modal" ? "report-form-modal" : ""}`}>
                <div className="form-group">
                    <label className="form-label">Upload Image</label>
                    <div
                        className={`image-drop-zone ${imagePreview ? "has-image" : ""} ${dragOver ? "drag-over" : ""}`}
                        onClick={() => document.getElementById("img-input")?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                    >
                        {imagePreview ? (
                            <img src={imagePreview} alt="Preview" className="image-preview" />
                        ) : (
                            <div className="drop-placeholder">
                                <span className="drop-icon">📷</span>
                                <p>Click or drag a photo here</p>
                                <span className="form-hint">JPEG/PNG with GPS metadata preferred</span>
                            </div>
                        )}
                    </div>
                    <input id="img-input" type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
                </div>

                <div className="form-group">
                    <label className="form-label">Description *</label>
                    <textarea
                        className="form-textarea"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the issue (e.g. large pothole blocking the road)"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Issue location *</label>
                    {locating && (
                        <p className="form-hint" style={{ marginBottom: 8 }}>Getting your GPS location…</p>
                    )}
                    {!coords && !locating && (
                        <p className="alert alert-error" style={{ marginBottom: 8, padding: "10px 12px" }}>
                            Pin the exact spot — tap <strong>Use My Current Location</strong> or click the map where the garbage is.
                        </p>
                    )}
                    <div ref={mapRef} className="location-map" />
                    <span className="form-hint">
                        We use your GPS automatically. Drag the pin if it is not exactly on the garbage spot.
                    </span>

                    <div className="location-actions">
                        <button type="button" className="btn-locate" onClick={getLocation} disabled={locating} style={{ flex: 1 }}>
                            {locating ? "Locating…" : "Use My Current Location"}
                        </button>
                        {coords && (
                            <a
                                href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary"
                            >
                                Verify on Maps
                            </a>
                        )}
                    </div>

                    {locStatus && (
                        <p
                            className="form-hint"
                            style={{
                                marginTop: 8,
                                fontWeight: 600,
                                color:
                                    locStatus.type === "success"
                                        ? "#22c55e"
                                        : locStatus.type === "warn"
                                            ? "#f59e0b"
                                            : "var(--text-secondary)",
                            }}
                        >
                            {locStatus.type === "success" ? "📍 " : locStatus.type === "warn" ? "⚠️ " : ""}
                            {locStatus.text}
                        </p>
                    )}

                    {coords && (
                        <p className="coords-text">
                            Captured: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                        </p>
                    )}
                </div>

                <button type="submit" className="btn-primary btn-full" disabled={loading}>
                    {loading ? "Submitting…" : "Submit Report"}
                </button>
            </form>
        </>
    );
}
