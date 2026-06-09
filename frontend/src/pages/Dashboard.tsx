import React from "react";
import ReportForm from "../components/ReportForm";

const TIPS = [
    { title: "Snap a clear photo", desc: "Include the full pothole or issue in frame. GPS from your photo auto-fills location." },
    { title: "Describe the problem", desc: "Mention severity — e.g. 'deep pothole blocking left lane' helps prioritization." },
    { title: "Pin the exact spot", desc: "Drag the map marker or paste a Google Maps link for precision." },
    { title: "AI classifies it", desc: "Our model detects potholes, garbage, and streetlight issues automatically." },
];

export default function Dashboard() {
    return (
        <div className="report-page-split">
            <div className="report-form-card">
                <div className="report-hero">
                    <h1>Report an Issue</h1>
                    <p>Help improve your city by reporting potholes, broken lights, and garbage.</p>
                </div>
                <ReportForm />
            </div>

            <aside className="report-tips-panel">
                <h3>How it works</h3>
                {TIPS.map((tip, i) => (
                    <div key={tip.title} className="tip-step">
                        <span className="tip-number">{i + 1}</span>
                        <div className="tip-content">
                            <h4>{tip.title}</h4>
                            <p>{tip.desc}</p>
                        </div>
                    </div>
                ))}
            </aside>
        </div>
    );
}
