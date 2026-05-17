import React, { useContext } from "react";
import { AuthContext } from "../App";
import ReportForm from "../components/ReportForm";

export default function Dashboard() {
    const { user } = useContext(AuthContext);

    return (
        <div className="report-page">
            <div className="report-form-card">
                <div className="report-hero">
                    <h1>Report an Issue</h1>
                    <p>Help us improve the city by pinning a problem on the map.</p>
                </div>
                <ReportForm />
            </div>
        </div>
    );
}
