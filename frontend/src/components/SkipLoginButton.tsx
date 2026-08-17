import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { CLERK_AFTER_AUTH_URL } from "../config/clerk";

type SkipLoginButtonProps = {
    className?: string;
    label?: string;
};

export default function SkipLoginButton({
    className = "btn-outline btn-full auth-skip-btn",
    label = "Continue without signing in",
}: SkipLoginButtonProps) {
    const { enterGuestMode } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSkip = () => {
        enterGuestMode();
        navigate(CLERK_AFTER_AUTH_URL);
    };

    return (
        <button type="button" className={className} onClick={handleSkip}>
            {label}
        </button>
    );
}
