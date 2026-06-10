import React, { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../App";
import { useClerkSession } from "../hooks/useClerkSession";
import { CLERK_AFTER_AUTH_URL } from "../config/clerk";
import { clearAuthSession } from "../utils/authSession";

type Props = {
    mode: "login" | "register";
    children: React.ReactNode;
};

export default function ClerkSignedInGate({ mode, children }: Props) {
    const { isSignedIn, isLoaded } = useClerkSession();
    const { user: clerkUser } = useUser();
    const { signOut } = useClerk();
    const { user, setUser } = useContext(AuthContext);
    const navigate = useNavigate();
    const [switching, setSwitching] = useState(false);

    useEffect(() => {
        if (user) navigate(CLERK_AFTER_AUTH_URL, { replace: true });
    }, [user, navigate]);

    if (user) {
        return (
            <div className="auth-card" style={{ textAlign: "center" }}>
                <div className="spinner" style={{ margin: "24px auto" }} />
                <p style={{ color: "#94A3B8" }}>Opening map…</p>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="auth-card" style={{ textAlign: "center" }}>
                <div className="spinner" style={{ margin: "24px auto" }} />
            </div>
        );
    }

    if (switching) {
        if (isSignedIn) {
            return (
                <div className="auth-card" style={{ textAlign: "center" }}>
                    <div className="spinner" style={{ margin: "24px auto" }} />
                    <p style={{ color: "#94A3B8" }}>Signing out…</p>
                </div>
            );
        }
        return <>{children}</>;
    }

    if (!isSignedIn) {
        return <>{children}</>;
    }

    const email = clerkUser?.primaryEmailAddress?.emailAddress || "your account";
    const title = mode === "register" ? "Already signed in" : "Welcome back";

    const handleContinue = () => {
        navigate(CLERK_AFTER_AUTH_URL, { replace: true });
    };

    const handleSwitchAccount = async () => {
        setSwitching(true);
        clearAuthSession();
        setUser(null);
        const returnPath = mode === "register" ? "/register" : "/login";
        try {
            await signOut({ redirectUrl: `${window.location.origin}${returnPath}` });
        } catch {
            setSwitching(false);
        }
    };

    return (
        <div className="auth-card" style={{ textAlign: "center" }}>
            <div className="auth-brand">📍 CivicWatch</div>
            <h2>{title}</h2>
            <p style={{ color: "#94A3B8", marginBottom: 20 }}>
                Signed in as <strong style={{ color: "#F8FAFC" }}>{email}</strong>
            </p>
            <button type="button" className="btn-primary btn-full" onClick={handleContinue} style={{ marginBottom: 12 }}>
                Continue
            </button>
            <button type="button" className="btn-outline btn-full" onClick={handleSwitchAccount}>
                Use a different Google account
            </button>
            {mode === "register" && (
                <p className="form-hint" style={{ marginTop: 16 }}>
                    Sign out first to create or sign in with another Google account.
                </p>
            )}
        </div>
    );
}
