import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { CLERK_AFTER_AUTH_URL } from "../config/clerk";

type GuestAccessPromptProps = {
    variant?: "login" | "hero";
};

export default function GuestAccessPrompt({ variant = "login" }: GuestAccessPromptProps) {
    const { enterGuestMode } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleGuestAccess = () => {
        enterGuestMode();
        navigate(CLERK_AFTER_AUTH_URL);
    };

    if (variant === "hero") {
        return (
            <p className="hero-guest-hint">
                No account needed —{" "}
                <button type="button" className="guest-access-link" onClick={handleGuestAccess}>
                    browse the map and report anonymously
                </button>
            </p>
        );
    }

    return (
        <div className="guest-access-block">
            <div className="auth-divider" aria-hidden="true">
                <span>or</span>
            </div>
            <button type="button" className="guest-access-card" onClick={handleGuestAccess}>
                <span className="guest-access-icon" aria-hidden="true">🗺️</span>
                <span className="guest-access-copy">
                    <strong>Explore without an account</strong>
                    <span>View nearby issues and report anonymously</span>
                </span>
                <span className="guest-access-arrow" aria-hidden="true">→</span>
            </button>
        </div>
    );
}
