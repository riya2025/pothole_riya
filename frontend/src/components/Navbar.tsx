import React, { useContext, useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../App";

function KebabIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <circle cx="10" cy="4" r="1.75" />
            <circle cx="10" cy="10" r="1.75" />
            <circle cx="10" cy="16" r="1.75" />
        </svg>
    );
}

export default function Navbar() {
    const { user, logout, isGuest, exitGuestMode } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        setIsMenuOpen(false);
    };

    const handleExitGuest = () => {
        exitGuestMode();
        setIsMenuOpen(false);
        navigate("/");
    };

    const showAppNav = user || isGuest;

    const closeMenu = () => setIsMenuOpen(false);

    const navLink = (to: string, label: string) => {
        const [path] = to.split("?");
        const isActive = location.pathname === path && (
            !to.includes("?") || location.search === to.slice(to.indexOf("?"))
        );
        return (
            <Link
                to={to}
                className={`nav-link ${isActive ? "active" : ""}`}
                onClick={closeMenu}
            >
                {label}
            </Link>
        );
    };

    return (
        <nav className="navbar">
            <div className="nav-brand" onClick={() => { navigate(showAppNav ? "/map" : "/"); closeMenu(); }}>
                <span className="brand-icon">📍</span>
                <span className="brand-name">CivicWatch</span>
            </div>

            <div className="nav-links nav-links-desktop">
                {!showAppNav && (
                    <>
                        {navLink("/", "Map View")}
                        {navLink("/admin-issues", "All Reports")}
                    </>
                )}
                {showAppNav && (
                    <>
                        {navLink("/map", "Nearby Map")}
                        {navLink("/map?report=1", "Report Issue")}
                        {user && navLink("/my-reports", "My Reports")}
                    </>
                )}
            </div>

            <div className="nav-actions nav-actions-desktop">
                {user ? (
                    <div className="user-menu">
                        <span className="user-badge">👤 {user.name || `User #${user.id}`}</span>
                        <button className="btn-outline" onClick={handleLogout}>Logout</button>
                    </div>
                ) : isGuest ? (
                    <div className="user-menu">
                        <span className="user-badge">Guest</span>
                        <Link to="/login" className="btn-primary">Sign In</Link>
                        <button className="btn-outline" onClick={handleExitGuest}>Exit</button>
                    </div>
                ) : (
                    <div className="auth-buttons">
                        <Link to="/login" className="btn-outline">Login</Link>
                        <Link to="/register" className="btn-primary">Sign Up</Link>
                    </div>
                )}
            </div>

            <div className="kebab-menu-wrapper" ref={menuRef}>
                <button
                    className="kebab-menu-toggle"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="Open menu"
                    aria-expanded={isMenuOpen}
                >
                    <KebabIcon />
                </button>

                {isMenuOpen && (
                    <div className="kebab-dropdown">
                        {!showAppNav && (
                            <>
                                {navLink("/", "Map View")}
                                {navLink("/admin-issues", "All Reports")}
                            </>
                        )}
                        {showAppNav && (
                            <>
                                {navLink("/map", "Nearby Map")}
                                {navLink("/map?report=1", "Report Issue")}
                                {user && navLink("/my-reports", "My Reports")}
                            </>
                        )}
                        <div className="kebab-dropdown-divider" />
                        {user ? (
                            <button className="kebab-dropdown-item danger" onClick={handleLogout}>
                                Logout
                            </button>
                        ) : isGuest ? (
                            <>
                                <Link to="/login" className="kebab-dropdown-item primary" onClick={closeMenu}>Sign In</Link>
                                <button className="kebab-dropdown-item" onClick={handleExitGuest}>Exit guest mode</button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="kebab-dropdown-item" onClick={closeMenu}>Login</Link>
                                <Link to="/register" className="kebab-dropdown-item primary" onClick={closeMenu}>Sign Up</Link>
                            </>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
}
