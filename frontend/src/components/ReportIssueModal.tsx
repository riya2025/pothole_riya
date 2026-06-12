import React, { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import ReportForm from "./ReportForm";

interface ReportIssueModalProps {
    open: boolean;
    onClose: () => void;
    initialCoords?: { lat: number; lng: number } | null;
}

export default function ReportIssueModal({
    open,
    onClose,
    initialCoords,
}: ReportIssueModalProps) {
    const scrollLockRef = useRef(0);
    const bodyRef = useRef<HTMLDivElement>(null);

    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    useEffect(() => {
        if (!open) return;

        scrollLockRef.current = window.scrollY;
        const scrollY = scrollLockRef.current;
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.width = "100%";
        document.body.style.overflow = "hidden";

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleClose();
        };
        window.addEventListener("keydown", onKey);

        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.position = "";
            document.body.style.top = "";
            document.body.style.left = "";
            document.body.style.right = "";
            document.body.style.width = "";
            document.body.style.overflow = "";
            window.scrollTo(0, scrollY);
        };
    }, [open, handleClose]);

    useEffect(() => {
        if (open && bodyRef.current) {
            bodyRef.current.scrollTop = 0;
        }
    }, [open]);

    if (!open) return null;

    const modal = (
        <div
            className="report-issue-overlay"
            onClick={handleClose}
            role="presentation"
        >
            <div
                className="report-issue-panel"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="report-issue-title"
            >
                <div className="report-issue-toolbar">
                    <h2 id="report-issue-title" className="report-issue-title">
                        Report an Issue
                    </h2>
                    <button
                        type="button"
                        className="issue-detail-close"
                        onClick={handleClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
                <div className="report-issue-body" ref={bodyRef}>
                    <p className="report-issue-hint">
                        Upload a photo — Groq vision will classify potholes, garbage, and streetlights.
                    </p>
                    <ReportForm
                        key={open ? "open" : "closed"}
                        variant="modal"
                        initialCoords={initialCoords ?? undefined}
                        skipAutoGps={Boolean(initialCoords)}
                    />
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
