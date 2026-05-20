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

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);

    // Initialize Map
    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        const defaultCenter: [number, number] = [12.9716, 77.5946]; // Bangalore
        const map = L.map(mapRef.current).setView(defaultCenter, 13);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors"
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

    // Sync marker with coordinates
    useEffect(() => {
        if (mapInstanceRef.current && markerRef.current && coords) {
            markerRef.current.setLatLng([coords.lat, coords.lng]);
            mapInstanceRef.current.panTo([coords.lat, coords.lng]);
        }
    }, [coords]);

    const parseGmapsLink = (url: string) => {
        setGmapsLink(url);
        // Regex to find @12.345,78.910 or similar patterns
        const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        const match = url.match(regex);
        if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            setCoords({ lat, lng });
            setError("");
        } else {
            // Also try searching for coordinates in query params q=12.3,45.6
            const qRegex = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
            const qMatch = url.match(qRegex);
            if (qMatch) {
                const lat = parseFloat(qMatch[1]);
                const lng = parseFloat(qMatch[2]);
                setCoords({ lat, lng });
                setError("");
            }
        }
    };

    const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImage(file);
            setImagePreview(URL.createObjectURL(file));

            try {
                const gps = await exifr.gps(file);
                if (gps && gps.latitude && gps.longitude) {
                    console.log("📍 EXIF Location detected:", gps);
                    setCoords({ lat: gps.latitude, lng: gps.longitude });
                    setSuccess({ type: "Location", status: "extracted", alertMsg: "Location successfully extracted from image metadata!" });
                    setError("");
                } else {
                    console.log("No EXIF GPS data found in image.");
                }
            } catch (err) {
                console.log("Could not extract EXIF data", err);
            }
        }
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
        <div className="report-form-card">
            <h2 className="section-title">📸 Report a Civic Issue</h2>

            {success && (
                <div className="alert alert-success">
                    ✅ Issue {success.status === "created" ? "created" : "attached to existing report"}!
                    <br />
                    Type: <strong>{issueIcon(success.type)} {success.type}</strong>
                    {success.address && <><br />Address: <em>{success.address}</em></>}
                </div>
            )}

            {error && <div className="alert alert-error">❌ {error}</div>}

            <form onSubmit={handleSubmit} className="report-form">
                <div className="form-group">
                    <label className="form-label">Upload Image</label>
                    <div
                        className={`image-drop-zone ${imagePreview ? "has-image" : ""}`}
                        onClick={() => document.getElementById("img-input")?.click()}
                    >
                        {imagePreview ? (
                            <img src={imagePreview} alt="Preview" className="image-preview" />
                        ) : (
                            <div className="drop-placeholder">
                                <span className="drop-icon">📷</span>
                                <p>Click to upload photo</p>
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
                        placeholder="Paste Google Maps URL here..."
                        value={gmapsLink}
                        onChange={(e) => parseGmapsLink(e.target.value)}
                    />
                    <small style={{ color: "#666" }}>Pasting a link will automatically move the map marker.</small>
                </div>

                <div className="form-group">
                    <label className="form-label">Location Picker *</label>
                    <div ref={mapRef} style={{ height: "200px", borderRadius: "8px", marginBottom: "10px", border: "1px solid #ddd" }} />
                    <p style={{ fontSize: "12px", color: "#666", marginBottom: "10px" }}>
                        Click on map or drag the marker to set exact location.
                    </p>

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <button type="button" className="btn-locate" onClick={getLocation} disabled={locating} style={{ flex: 1 }}>
                            {locating ? "📍 Locating…" : "📍 Use My Current Location"}
                        </button>
                        {coords && (
                            <a
                                href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary"
                                style={{ display: "flex", alignItems: "center", textDecoration: "none", color: "inherit" }}
                            >
                                📍 Verify Gmaps
                            </a>
                        )}
                    </div>

                    {coords && (
                        <p className="coords-text" style={{ marginTop: "10px" }}>
                            📌 Captured: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                        </p>
                    )}
                </div>

                <button type="submit" className="btn-primary btn-full" disabled={loading}>
                    {loading ? "Submitting…" : "🚀 Submit Report"}
                </button>
            </form>
        </div>
    );
}
