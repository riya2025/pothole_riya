import React from "react";
import ReportForm from "../components/ReportForm";
import { useNavigate } from "react-router-dom";

export default function ReportIssue() {
    const navigate = useNavigate();

    return (
        <div className="report-page">
            <div className="report-page-inner">
                <div className="report-hero">
                    <h1>🚨 Report a Civic Issue</h1>
                    <p>Help your community by reporting potholes, garbage, broken streetlights, or any other civic problem.</p>
                </div>
                <ReportForm
                    onSuccess={() => setTimeout(() => navigate("/"), 2500)}
                />
            </div>
        </div>
    );
}
