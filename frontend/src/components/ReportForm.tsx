import React, { useState, useContext, ChangeEvent, FormEvent } from "react";
import { reportIssue } from "../services/api";
import { AuthContext } from "../App";
import { issueIcon } from "../utils/helpers";
import exifr from 'exifr';

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
    const [error, setError] = useState("");
    const [success, setSuccess] = useState<any>(null);

    const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImage(file);
            setImagePreview(URL.createObjectURL(file));

            // Try extracting EXIF GPS data
            try {
                const gps = await exifr.gps(file);
                if (gps && gps.latitude && gps.longitude) {
                    setCoords({ lat: gps.latitude, lng: gps.longitude });
                    setSuccess({ type: "Location", status: "extracted", alertMsg: "Location successfully extracted from image metadata!" });
                    setError("");
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
                    <label className="form-label">Location *</label>
                    <button type="button" className="btn-locate" onClick={getLocation} disabled={locating}>
                        {locating ? "📍 Locating…" : coords ? "✅ Location Captured" : "📍 Capture My Location"}
                    </button>
                    {coords && (
                        <p className="coords-text">
                            📌 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
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
