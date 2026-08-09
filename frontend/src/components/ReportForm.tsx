import React, { useState, ChangeEvent, FormEvent, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { reportIssue, analyzeIssueImage } from "../services/api";
import { ReportSubmitResult } from "../types";
import { compressImage } from "../utils/image";
import exifr from "exifr";
import L from "leaflet";
import { MAP_TILE_OPTIONS, MAP_TILE_URL } from "../config/map";
import { FlashIcon, GalleryIcon, MicIcon } from "./CaptureIcons";

type MediaKind = "image" | "video" | "audio";

interface ReportFormProps {
    onSuccess?: (data: any) => void;
    variant?: "page" | "modal";
    initialCoords?: { lat: number; lng: number };
    skipAutoGps?: boolean;
}

const VIDEO_MAX_MS = 15000;
const VOICE_MAX_MS = 15000;
const HOLD_THRESHOLD_MS = 220;

function pickRecorderMime(kind: "video" | "audio"): string | undefined {
    const candidates =
        kind === "video"
            ? ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
            : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    if (typeof MediaRecorder === "undefined") return undefined;
    return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function extForMime(mime: string, kind: MediaKind): string {
    if (kind === "image") {
        if (mime.includes("png")) return "png";
        if (mime.includes("webp")) return "webp";
        return "jpg";
    }
    if (mime.includes("mp4")) return kind === "audio" ? "m4a" : "mp4";
    if (mime.includes("ogg")) return "ogg";
    return "webm";
}

export default function ReportForm({
    onSuccess,
    variant = "page",
    initialCoords,
    skipAutoGps = false,
}: ReportFormProps) {
    const navigate = useNavigate();
    const [description, setDescription] = useState("");
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [mediaKind, setMediaKind] = useState<MediaKind | null>(null);
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false);
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [error, setError] = useState("");
    const [dragOver, setDragOver] = useState(false);
    const [locStatus, setLocStatus] = useState<{ type: "info" | "success" | "warn"; text: string } | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [descAutoFilled, setDescAutoFilled] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [flashOn, setFlashOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const [recording, setRecording] = useState(false);
    const [recordingKind, setRecordingKind] = useState<"video" | "audio" | null>(null);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [holding, setHolding] = useState(false);
    const flashOnRef = useRef(false);
    flashOnRef.current = flashOn;

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const videoPreviewRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);
    const tickRef = useRef<number | null>(null);
    const holdTimerRef = useRef<number | null>(null);
    const holdStartedRef = useRef(false);
    const recordingKindRef = useRef<"video" | "audio" | null>(null);
    const descriptionRef = useRef(description);
    descriptionRef.current = description;

    const applyCoordsToMap = (lat: number, lng: number, zoom = 16) => {
        const map = mapInstanceRef.current;
        const marker = markerRef.current;
        if (!map || !marker) return;
        marker.setLatLng([lat, lng]);
        map.setView([lat, lng], zoom, { animate: true });
    };

    const trackSupportsTorch = (track?: MediaStreamTrack | null) => {
        if (!track?.getCapabilities) return false;
        const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
        return Boolean(caps.torch);
    };

    const applyTorch = useCallback(async (enabled: boolean, stream?: MediaStream | null) => {
        const active = stream ?? streamRef.current;
        const track = active?.getVideoTracks?.()[0];
        if (!track || !trackSupportsTorch(track)) {
            setTorchSupported(false);
            return false;
        }
        setTorchSupported(true);
        try {
            await track.applyConstraints({
                advanced: [{ torch: enabled } as MediaTrackConstraintSet],
            });
            return true;
        } catch {
            // Browser reported capability but rejected the constraint — treat as unsupported.
            setTorchSupported(false);
            return false;
        }
    }, []);

    const stopStream = useCallback(() => {
        const track = streamRef.current?.getVideoTracks?.()[0];
        // Only touch torch when the device actually supports it; otherwise
        // applyConstraints rejects with "Unsupported constraint" (uncaught if not awaited).
        if (track && trackSupportsTorch(track) && flashOnRef.current) {
            track
                .applyConstraints({
                    advanced: [{ torch: false } as MediaTrackConstraintSet],
                })
                .catch(() => undefined);
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
        setCameraReady(false);
        setTorchSupported(false);
    }, []);

    const clearTimers = useCallback(() => {
        if (timerRef.current != null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (tickRef.current != null) {
            window.clearInterval(tickRef.current);
            tickRef.current = null;
        }
        if (holdTimerRef.current != null) {
            window.clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
    }, []);

    const revokePreview = useCallback(() => {
        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    }, [mediaPreview]);

    const clearCapturedMedia = useCallback(() => {
        clearTimers();
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
            try {
                recorderRef.current.stop();
            } catch {
                /* ignore */
            }
        }
        recorderRef.current = null;
        chunksRef.current = [];
        setRecording(false);
        setRecordingKind(null);
        setElapsedMs(0);
        setHolding(false);
        holdStartedRef.current = false;
        recordingKindRef.current = null;
        revokePreview();
        setMediaFile(null);
        setMediaPreview(null);
        setMediaKind(null);
        // Retake should wipe auto-filled / previous text so the next capture can refill.
        setDescription("");
        setDescAutoFilled(false);
        setAnalyzing(false);
    }, [clearTimers, revokePreview]);

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

        return () => {
            map.remove();
            mapInstanceRef.current = null;
            markerRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (coords) {
            applyCoordsToMap(coords.lat, coords.lng);
            markerRef.current?.setOpacity(1);
        }
    }, [coords]);

    const getLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported. Click the map to set the spot.");
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
                setError("Could not get your location. Allow GPS, or click the map.");
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    }, []);

    useEffect(() => {
        if (initialCoords) {
            setCoords(initialCoords);
            return;
        }
        if (!skipAutoGps) {
            getLocation();
        }
    }, [initialCoords, skipAutoGps, getLocation]);

    const startCameraPreview = useCallback(async () => {
        stopStream();
        if (!navigator.mediaDevices?.getUserMedia) {
            setError("Camera not available in this browser. Use Upload instead.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" },
                    // Prefer rear camera with torch capability when available.
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: true,
            });
            streamRef.current = stream;
            if (videoPreviewRef.current) {
                videoPreviewRef.current.srcObject = stream;
                await videoPreviewRef.current.play().catch(() => undefined);
            }
            const track = stream.getVideoTracks()[0];
            const caps = (track?.getCapabilities?.() || {}) as MediaTrackCapabilities & { torch?: boolean };
            setTorchSupported(Boolean(caps.torch));
            if (flashOnRef.current && caps.torch) {
                await applyTorch(true, stream);
            }
            setCameraReady(true);
            setError("");
        } catch {
            setError("Camera permission denied. Use the gallery button or hold the mic for voice.");
            setCameraReady(false);
            setTorchSupported(false);
        }
    }, [stopStream, applyTorch]);

    const toggleFlash = useCallback(async () => {
        const next = !flashOn;
        const ok = await applyTorch(next);
        if (!ok) {
            setError("Flash/torch isn’t available on this camera. Try a phone rear camera in Chrome.");
            setFlashOn(false);
            setTorchSupported(false);
            return;
        }
        setFlashOn(next);
        setError("");
    }, [flashOn, applyTorch]);

    useEffect(() => {
        if (!mediaFile) {
            void startCameraPreview();
        } else {
            stopStream();
        }
    }, [mediaFile, startCameraPreview, stopStream]);

    useEffect(() => {
        return () => {
            clearTimers();
            stopStream();
            if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const detectGpsFromImage = async (file: File) => {
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
            /* fall through */
        }
        setLocStatus({
            type: "warn",
            text: "No GPS data in this photo — use “Use My Current Location” or tap the map.",
        });
    };

    const isPlaceholderDesc = (text: string) => {
        const t = text.trim().toLowerCase();
        return (
            !t ||
            t.startsWith("quick traffic report") ||
            t.startsWith("could not auto-describe") ||
            t.startsWith("unclear mark or fixture")
        );
    };

    const autoDescribeMedia = async (file: File, kind: "image" | "video") => {
        setAnalyzing(true);
        setDescAutoFilled(false);
        const mediaFallback =
            kind === "video"
                ? "Issue shown in the uploaded video — please edit this description."
                : "Issue shown in the uploaded photo — please edit this description.";
        const categoryFallback = (category: string) => {
            switch ((category || "").toLowerCase()) {
                case "garbage":
                    return "Garbage or litter piled on the roadside.";
                case "pothole":
                    return "Road surface damage that looks like a pothole or crack.";
                case "streetlight":
                    return "Damaged or non-working streetlight.";
                default:
                    return mediaFallback;
            }
        };
        const fillIfEmpty = (text: string) => {
            if (!isPlaceholderDesc(descriptionRef.current)) return;
            const next = (text || "").trim();
            if (!next) return;
            setDescription(next);
            setDescAutoFilled(true);
        };
        try {
            const formData = new FormData();
            if (kind === "video") {
                formData.append("media", file);
            } else {
                formData.append("image", file);
            }
            const res = await analyzeIssueImage(formData);
            const suggestion = (res.data?.description || "").trim();
            const category = (res.data?.category || "").trim();
            const source = String(res.data?.source || "");
            const unusable =
                !suggestion ||
                isPlaceholderDesc(suggestion) ||
                source.includes("failed") ||
                source === "unavailable" ||
                source === "no_frames";
            if (!unusable) {
                fillIfEmpty(suggestion);
            } else if (category && category.toLowerCase() !== "other") {
                fillIfEmpty(categoryFallback(category));
            } else {
                fillIfEmpty(mediaFallback);
            }
        } catch {
            // Timeout / rate-limit / network — never leave the box blank after upload.
            fillIfEmpty(mediaFallback);
        } finally {
            setAnalyzing(false);
        }
    };

    const setCapturedFile = (file: File, kind: MediaKind, runAnalyze: boolean) => {
        revokePreview();
        setMediaFile(file);
        setMediaKind(kind);
        setMediaPreview(URL.createObjectURL(file));
        if (runAnalyze && (kind === "image" || kind === "video")) {
            void autoDescribeMedia(file, kind);
        }
    };

    const processImageFile = async (file: File) => {
        await detectGpsFromImage(file);
        const optimized = await compressImage(file).catch(() => file);
        setCapturedFile(optimized, "image", true);
    };

    const processVideoFile = (file: File) => {
        setCapturedFile(file, "video", true);
    };

    const processUploadFile = async (file: File) => {
        if (file.type.startsWith("image/")) {
            await processImageFile(file);
        } else if (file.type.startsWith("video/")) {
            processVideoFile(file);
        } else {
            setError("Please upload an image or video file.");
        }
    };

    const handleUploadChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processUploadFile(file);
        e.target.value = "";
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) await processUploadFile(file);
    };

    const finishRecording = (blob: Blob, mime: string, kind: "video" | "audio") => {
        const ext = extForMime(mime || blob.type, kind);
        const filename = kind === "audio" ? `voice_report.${ext}` : `video_report.${ext}`;
        const file = new File([blob], filename, { type: mime || blob.type });
        setRecording(false);
        setRecordingKind(null);
        setHolding(false);
        clearTimers();
        stopStream();
        if (kind === "video") {
            setCapturedFile(file, "video", true);
            return;
        }
        setCapturedFile(file, "audio", false);
        if (isPlaceholderDesc(descriptionRef.current)) {
            setDescription("Quick traffic report — voice note");
            setDescAutoFilled(true);
        }
    };

    const startRecording = async (kind: "video" | "audio") => {
        setError("");
        try {
            let stream = streamRef.current;
            if (!stream || kind === "audio") {
                stopStream();
                stream = await navigator.mediaDevices.getUserMedia(
                    kind === "video"
                        ? { video: { facingMode: { ideal: "environment" } }, audio: true }
                        : { audio: true }
                );
                streamRef.current = stream;
                if (kind === "video" && videoPreviewRef.current) {
                    videoPreviewRef.current.srcObject = stream;
                    await videoPreviewRef.current.play().catch(() => undefined);
                    setCameraReady(true);
                    if (flashOnRef.current) {
                        await applyTorch(true, stream);
                    }
                }
            }

            const mime = pickRecorderMime(kind);
            const recorder = mime
                ? new MediaRecorder(stream, { mimeType: mime })
                : new MediaRecorder(stream);
            recorderRef.current = recorder;
            chunksRef.current = [];
            recordingKindRef.current = kind;

            recorder.ondataavailable = (ev) => {
                if (ev.data.size > 0) chunksRef.current.push(ev.data);
            };
            recorder.onstop = () => {
                const usedMime = recorder.mimeType || mime || (kind === "video" ? "video/webm" : "audio/webm");
                const blob = new Blob(chunksRef.current, { type: usedMime });
                if (blob.size > 0) {
                    finishRecording(blob, usedMime, kind);
                } else {
                    setRecording(false);
                    setRecordingKind(null);
                    setHolding(false);
                }
            };

            recorder.start(200);
            setRecording(true);
            setRecordingKind(kind);
            setElapsedMs(0);
            const started = Date.now();
            tickRef.current = window.setInterval(() => {
                setElapsedMs(Date.now() - started);
            }, 100);

            const maxMs = kind === "video" ? VIDEO_MAX_MS : VOICE_MAX_MS;
            timerRef.current = window.setTimeout(() => {
                if (recorderRef.current && recorderRef.current.state !== "inactive") {
                    recorderRef.current.stop();
                }
            }, maxMs);
        } catch {
            setError(
                kind === "video"
                    ? "Could not start camera recording. Try Upload or Voice."
                    : "Could not access microphone. Allow mic access or use Upload."
            );
            setRecording(false);
            setRecordingKind(null);
            setHolding(false);
            holdStartedRef.current = false;
        }
    };

    const stopRecording = () => {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
            recorderRef.current.stop();
        }
    };

    const captureStillPhoto = async () => {
        const video = videoPreviewRef.current;
        const stream = streamRef.current;
        if (!video || !stream || !cameraReady) {
            setError("Camera not ready yet.");
            return;
        }
        try {
            const w = video.videoWidth || 1280;
            const h = video.videoHeight || 720;
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("canvas");
            ctx.drawImage(video, 0, 0, w, h);
            const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, "image/jpeg", 0.9)
            );
            if (!blob) throw new Error("blob");
            const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
            stopStream();
            await processImageFile(file);
        } catch {
            setError("Could not capture photo. Try again or use Upload.");
        }
    };

    const onShutterDown = (e: React.PointerEvent) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        if (recording || mediaFile) return;
        setHolding(true);
        holdStartedRef.current = false;
        holdTimerRef.current = window.setTimeout(() => {
            holdStartedRef.current = true;
            startRecording("video");
        }, HOLD_THRESHOLD_MS);
    };

    const onShutterUp = (e: React.PointerEvent) => {
        e.preventDefault();
        if (holdTimerRef.current != null) {
            window.clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
        if (recording && recordingKindRef.current === "video") {
            stopRecording();
            return;
        }
        if (!holdStartedRef.current && !mediaFile) {
            setHolding(false);
            void captureStillPhoto();
            return;
        }
        setHolding(false);
    };

    const onVoiceDown = (e: React.PointerEvent) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        if (recording || mediaFile) return;
        setHolding(true);
        holdStartedRef.current = true;
        void startRecording("audio");
    };

    const onVoiceUp = (e: React.PointerEvent) => {
        e.preventDefault();
        if (recording && recordingKindRef.current === "audio") {
            stopRecording();
        }
        setHolding(false);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (recording) {
            setError("Release the button to finish recording first.");
            return;
        }
        if (!coords) {
            setError("Set the issue location first — use GPS or click the map.");
            return;
        }
        const desc = description.trim() || (
            mediaKind === "audio"
                ? "Quick traffic report — voice note"
                : mediaKind === "video"
                    ? "Quick traffic report — video clip"
                    : ""
        );
        if (!desc) {
            setError("Please add a description, or capture a photo for auto-description.");
            return;
        }

        setLoading(true);
        setError("");
        try {
            const formData = new FormData();
            formData.append("description", desc);
            formData.append("latitude", coords.lat.toString());
            formData.append("longitude", coords.lng.toString());
            if (mediaFile && mediaKind) {
                if (mediaKind === "image") {
                    formData.append("image", mediaFile);
                } else {
                    formData.append("media", mediaFile, mediaFile.name);
                }
            }

            const res = await reportIssue(formData);
            const payload: ReportSubmitResult = {
                ...res.data,
                description: desc,
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

    const maxMs = recordingKind === "audio" ? VOICE_MAX_MS : VIDEO_MAX_MS;
    const elapsedLabel = `${(Math.min(elapsedMs, maxMs) / 1000).toFixed(1)}s`;
    const isVoiceRecording = recording && recordingKind === "audio";

    return (
        <>
            {error && <div className="alert alert-error">{error}</div>}

            <form
                onSubmit={handleSubmit}
                className={`report-form ${variant === "modal" ? "report-form-modal" : ""}`}
            >
                <div className="form-group">
                    <label className="form-label">Evidence</label>
                    <div
                        className={`report-capture-stage ${dragOver ? "drag-over" : ""} ${isVoiceRecording ? "voice-recording" : ""}`}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                    >
                        {mediaFile && mediaKind === "image" && mediaPreview ? (
                            <img src={mediaPreview} alt="Captured" className="report-capture-preview" />
                        ) : mediaFile && mediaKind === "video" && mediaPreview ? (
                            <video src={mediaPreview} className="report-capture-preview" controls playsInline />
                        ) : mediaFile && mediaKind === "audio" && mediaPreview ? (
                            <div className="report-audio-preview">
                                <p className="report-audio-title">Voice note ready</p>
                                <audio src={mediaPreview} controls className="report-audio-el" />
                            </div>
                        ) : (
                            <>
                                <video
                                    ref={videoPreviewRef}
                                    className="report-capture-preview live"
                                    muted
                                    playsInline
                                    autoPlay
                                />
                                {!cameraReady && !isVoiceRecording && (
                                    <div className="report-capture-placeholder">Starting camera…</div>
                                )}
                                {isVoiceRecording && (
                                    <div className="report-capture-placeholder voice-live">
                                        Listening… {elapsedLabel}
                                    </div>
                                )}
                                {recording && !isVoiceRecording && (
                                    <div className="report-rec-badge">REC {elapsedLabel}</div>
                                )}
                                {cameraReady && !isVoiceRecording && (
                                    <button
                                        type="button"
                                        className={`report-flash-btn ${flashOn ? "on" : ""} ${!torchSupported ? "unsupported" : ""}`}
                                        aria-label={flashOn ? "Turn flash off" : "Turn flash on"}
                                        aria-pressed={flashOn}
                                        title={
                                            torchSupported
                                                ? flashOn
                                                    ? "Flash on — tap to turn off"
                                                    : "Flash off — tap for night capture"
                                                : "Flash needs a phone rear camera (Chrome/Android)"
                                        }
                                        onClick={() => void toggleFlash()}
                                    >
                                        <FlashIcon on={flashOn} size={18} />
                                        <small>{flashOn ? "On" : "Flash"}</small>
                                    </button>
                                )}
                            </>
                        )}

                        {!mediaFile ? (
                            <div className="report-capture-bar">
                                <button
                                    type="button"
                                    className="report-side-btn"
                                    aria-label="Upload from gallery"
                                    disabled={recording}
                                    onClick={() => document.getElementById("media-upload-input")?.click()}
                                >
                                    <GalleryIcon size={22} />
                                    <small>Gallery</small>
                                </button>

                                <button
                                    type="button"
                                    className={`report-shutter-btn ${holding || recording ? "active" : ""} ${recording && !isVoiceRecording ? "recording" : ""}`}
                                    aria-label="Tap for photo, hold for video"
                                    disabled={isVoiceRecording}
                                    onPointerDown={onShutterDown}
                                    onPointerUp={onShutterUp}
                                    onPointerCancel={onShutterUp}
                                    onContextMenu={(e) => e.preventDefault()}
                                >
                                    <span className="report-shutter-ring" />
                                    <span className="report-shutter-core" />
                                </button>

                                <button
                                    type="button"
                                    className={`report-side-btn report-side-voice ${holding && isVoiceRecording ? "active" : ""}`}
                                    aria-label="Hold for voice note"
                                    disabled={recording && !isVoiceRecording}
                                    onPointerDown={onVoiceDown}
                                    onPointerUp={onVoiceUp}
                                    onPointerCancel={onVoiceUp}
                                    onContextMenu={(e) => e.preventDefault()}
                                >
                                    <MicIcon size={22} />
                                    <small>Voice</small>
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="btn-outline report-retake-btn"
                                onClick={() => clearCapturedMedia()}
                            >
                                Retake
                            </button>
                        )}
                    </div>
                    {!mediaFile && (
                        <p className="form-hint report-shutter-hint">
                            Tap photo · Hold video · Voice · Gallery
                            {torchSupported ? " · Flash" : ""}
                        </p>
                    )}
                    <input
                        id="media-upload-input"
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleUploadChange}
                        style={{ display: "none" }}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Description *</label>
                    <textarea
                        className="form-textarea"
                        rows={3}
                        value={description}
                        onChange={(e) => {
                            setDescription(e.target.value);
                            setDescAutoFilled(false);
                        }}
                        placeholder="Describe the issue (e.g. large pothole blocking the road)"
                    />
                    {analyzing && (
                        <span className="form-hint" style={{ marginTop: 6, display: "block" }}>
                            {mediaKind === "video"
                                ? "Analyzing video with Groq (reading a frame)…"
                                : "Analyzing photo with Groq to suggest a description…"}
                        </span>
                    )}
                    {descAutoFilled && !analyzing && (
                        <span
                            className="form-hint"
                            style={{ marginTop: 6, display: "block", color: "#818cf8", fontWeight: 600 }}
                        >
                            Auto-filled from your {mediaKind === "video" ? "video" : "photo"} — edit if anything&apos;s off.
                        </span>
                    )}
                </div>

                <div className="form-group">
                    <label className="form-label">Issue location *</label>
                    {locating && (
                        <p className="form-hint" style={{ marginBottom: 8 }}>
                            Getting your GPS location…
                        </p>
                    )}
                    {!coords && !locating && (
                        <p className="alert alert-error" style={{ marginBottom: 8, padding: "10px 12px" }}>
                            Pin the exact spot — tap <strong>Use My Current Location</strong> or click the map.
                        </p>
                    )}
                    <div ref={mapRef} className="location-map" />
                    <span className="form-hint">
                        We use your GPS automatically. Drag the pin if it is not exactly on the issue.
                    </span>

                    <div className="location-actions">
                        <button
                            type="button"
                            className="btn-locate"
                            onClick={getLocation}
                            disabled={locating}
                            style={{ flex: 1 }}
                        >
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

                <button type="submit" className="btn-primary btn-full" disabled={loading || recording}>
                    {loading ? "Submitting…" : "Submit Report"}
                </button>
            </form>
        </>
    );
}
