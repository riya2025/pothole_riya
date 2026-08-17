import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { CLERK_AFTER_AUTH_URL } from "../config/clerk";

export default function GuestAccessPrompt() {
    const { enterGuestMode } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSkip = () => {
        enterGuestMode();
        navigate(CLERK_AFTER_AUTH_URL);
    };

    return (
        <p className="auth-skip">
            <button type="button" className="auth-skip-link" onClick={handleSkip}>
                Skip
            </button>
        </p>
    );
}
