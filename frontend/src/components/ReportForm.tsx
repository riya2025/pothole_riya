import React, { useState, useContext, ChangeEvent, FormEvent, useEffect, useRef } from "react";
import { reportIssue } from "../services/api";
import { AuthContext } from "../App";
import { issueIcon } from "../utils/helpers";
import exifr from 'exifr';
import L from "leaflet";

interface ReportFormProps {
    onSuccess?: (data: any) => void;
}

export default function ReportForm({ onSuccess }: ReportFormProps) {
    const { user } = useContext(AuthContext);
    const [description, setDescription] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false);
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [gmapsLink, setGmapsLink] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState<any>(null);
    const [dragOver, setDragOver] = useState(false);

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        const defaultCenter: [number, number] = [12.9716, 77.5946];
        const map = L.map(mapRef.current).setView(defaultCenter, 13);

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
            attribution: "© OpenStreetMap © CARTO",
            subdomains: "abcd",
        }).addTo(map);

        const marker = L.marker(defaultCenter, { draggable: true }).addTo(map);
        marker.on('dragend', () => {
            const position = marker.getLatLng();
            setCoords({ lat: position.lat, lng: position.lng });
        });

        map.on('click', (e) => {
            marker.setLatLng(e.latlng);
            setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (mapInstanceRef.current && markerRef.current && coords) {
            markerRef.current.setLatLng([coords.lat, coords.lng]);
            mapInstanceRef.current.panTo([coords.lat, coords.lng]);
        }
    }, [coords]);

    const parseGmapsLink = (url: string) => {
        setGmapsLink(url);
        const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        const match = url.match(regex);
        if (match) {
            setCoords({ lat: parseFloat(match[1]), lng: parseFloat(match[2]) });
            setError("");
        } else {
            const qRegex = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
            const qMatch = url.match(qRegex);
            if (qMatch) {
                setCoords({ lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) });
                setError("");
            }
        }
    };

    const processImage = async (file: File) => {
        setImage(file);
        setImagePreview(URL.createObjectURL(file));

        try {
            const gps = await exifr.gps(file);
            if (gps?.latitude && gps?.longitude) {
                setCoords({ lat: gps.latitude, lng: gps.longitude });
                setSuccess({ type: "Location", status: "extracted", alertMsg: "Location extracted from photo metadata!" });
                setError("");
            }
        } catch {
            /* no EXIF */
        }
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
        setLocating(true);
        setError("");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocating(false);
            },
            () => {
                setError("Could not get location. Please allow location access.");
                setLocating(false);
            }
        );
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!coords) { setError("Please capture your location first."); return; }
        if (!description.trim()) { setError("Please add a description."); return; }

        setLoading(true);
        setError("");
        setSuccess(null);
        try {
            const formData = new FormData();
            formData.append("description", description);
            formData.append("latitude", coords.lat.toString());
            formData.append("longitude", coords.lng.toString());
            if (image) formData.append("image", image);

            const res = await reportIssue(formData);
            setSuccess(res.data);
            setDescription("");
            setImage(null);
            setImagePreview(null);
            setCoords(null);
            setGmapsLink("");
            if (onSuccess) onSuccess(res.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to submit report.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {success && (
                <div className="alert alert-success">
                    Issue {success.status === "created" ? "created" : "attached to existing report"}!
                    <br />
                    Type: <strong>{issueIcon(success.type)} {success.type}</strong>
                    {success.address && <><br />Address: <em>{success.address}</em></>}
                </div>
            )}

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className="report-form">
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
                    <label className="form-label">Google Maps Link (Optional)</label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Paste Google Maps URL here…"
                        value={gmapsLink}
                        onChange={(e) => parseGmapsLink(e.target.value)}
                    />
                    <span className="form-hint">Pasting a link will automatically move the map marker.</span>
                </div>

                <div className="form-group">
                    <label className="form-label">Location Picker *</label>
                    <div ref={mapRef} className="location-map" />
                    <span className="form-hint">Click on the map or drag the marker to set the exact location.</span>

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
