import React, { useContext } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../App";

export default function Navbar() {
    const { user, setUser } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem("token");
        setUser(null);
        navigate("/");
    };

    const navLink = (to: string, label: string) => (
        <Link
            to={to}
            className={`nav-link ${location.pathname === to ? "active" : ""}`}
        >
            {label}
        </Link>
    );

    return (
        <nav className="navbar">
            <div className="nav-brand">
                <span className="brand-icon">📍</span>
                <span className="brand-name">CivicWatch</span>
            </div>
            <div className="nav-links">
                {navLink("/", "🗺️ Admin Dashboard")}
                {user && navLink("/dashboard", "📋 User Dashboard")}
            </div>
            <div className="nav-actions">
                {user ? (
                    <div className="user-menu">
                        <span className="user-badge">👤 User #{user.id}</span>
                        <button className="btn-outline" onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                ) : (
                    <div className="auth-buttons">
                        <Link to="/login" className="btn-outline">Login</Link>
                        <Link to="/register" className="btn-primary">Sign Up</Link>
                    </div>
                )}
            </div>
        </nav>
    );
}
