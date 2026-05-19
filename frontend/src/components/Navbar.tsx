import React, { useContext, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../App";

export default function Navbar() {
    const { user, setUser } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem("token");
        setUser(null);
        navigate("/");
    };

    const closeMenu = () => setIsMobileMenuOpen(false);

    const navLink = (to: string, label: string) => (
        <Link
            to={to}
            className={`nav-link ${location.pathname === to ? "active" : ""}`}
            onClick={closeMenu}
        >
            {label}
        </Link>
    );

    return (
        <nav className="navbar">
            <div className="nav-brand" onClick={() => { navigate("/"); closeMenu(); }}>
                <span className="brand-icon">📍</span>
                <span className="brand-name">CivicWatch</span>
            </div>

            <button
                className="mobile-menu-toggle"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle navigation"
            >
                {isMobileMenuOpen ? "✖" : "☰"}
            </button>

            <div className={`nav-collapse ${isMobileMenuOpen ? "open" : ""}`}>
                <div className="nav-links">
                    {!user && (
                        <>
                            {navLink("/", "🗺️ Map View")}
                            {navLink("/admin-issues", "📋 All Reports")}
                        </>
                    )}
                    {user && (
                        <>
                            {navLink("/dashboard", "📋 Report Issue")}
                            {navLink("/my-reports", "📊 My Reports")}
                        </>
                    )}
                </div>
                <div className="nav-actions">
                    {user ? (
                        <div className="user-menu">
                            <span className="user-badge">👤 User #{user.id}</span>
                            <button className="btn-outline" onClick={() => { handleLogout(); closeMenu(); }}>
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div className="auth-buttons">
                            <Link to="/login" className="btn-outline" onClick={closeMenu}>Login</Link>
                            <Link to="/register" className="btn-primary" onClick={closeMenu}>Sign Up</Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
