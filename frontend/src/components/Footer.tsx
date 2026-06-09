import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
    return (
        <footer className="site-footer">
            <div className="footer-inner">
                <div className="footer-brand">
                    <span className="brand-icon">📍</span>
                    <span className="brand-name">CivicWatch</span>
                    <p className="footer-tagline">Report civic issues. Track resolutions. Make cities better.</p>
                </div>
                <div className="footer-links">
                    <div className="footer-col">
                        <h4>Explore</h4>
                        <Link to="/">Map View</Link>
                        <Link to="/admin-issues">All Reports</Link>
                    </div>
                    <div className="footer-col">
                        <h4>Account</h4>
                        <Link to="/login">Sign In</Link>
                        <Link to="/register">Create Account</Link>
                    </div>
                    <div className="footer-col">
                        <h4>Cities</h4>
                        <span>Hyderabad</span>
                        <span>Bangalore</span>
                    </div>
                </div>
            </div>
            <div className="footer-bottom">
                <span>© {new Date().getFullYear()} CivicWatch</span>
                <span className="footer-badge">Powered by AI classification</span>
            </div>
        </footer>
    );
}
