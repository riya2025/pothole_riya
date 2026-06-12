import React, { useState, useContext, FormEvent, useEffect } from "react";
import { SignIn } from "@clerk/clerk-react";
import { login } from "../services/api";
import { AuthContext } from "../App";
import { parseJwt } from "../utils/helpers";
import { persistAuthSession } from "../utils/authSession";
import { useNavigate, Link } from "react-router-dom";
import { isClerkEnabled, clerkAppearance, CLERK_AFTER_AUTH_URL } from "../config/clerk";
import { useClerkSession } from "../hooks/useClerkSession";
import ClerkSignedInGate from "../components/ClerkSignedInGate";

function ClerkLoginPanel() {
    const { user, clerkSyncing } = useContext(AuthContext);
    const { isLoaded: clerkLoaded } = useClerkSession();
    const navigate = useNavigate();

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

    if (clerkSyncing || !clerkLoaded) {
        return (
            <div className="auth-card" style={{ textAlign: "center" }}>
                <div className="spinner" style={{ margin: "24px auto" }} />
                <p style={{ color: "#94A3B8" }}>Signing you in…</p>
            </div>
        );
    }

    return (
        <ClerkSignedInGate mode="login">
            <div className="clerk-auth-container">
                <SignIn
                    routing="path"
                    path="/login"
                    signUpUrl="/register"
                    fallbackRedirectUrl={CLERK_AFTER_AUTH_URL}
                    appearance={clerkAppearance}
                />
            </div>
        </ClerkSignedInGate>
    );
}

function LegacyLoginForm() {
    const { setUser } = useContext(AuthContext);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true); setError("");
        try {
            const res = await login(email, password);
            const payload = parseJwt(res.data.access_token);
            const nextUser = { id: Number(payload?.sub), name: email.split("@")[0], email };
            persistAuthSession(nextUser, "legacy", res.data.access_token);
            setUser(nextUser);
            navigate(CLERK_AFTER_AUTH_URL);
        } catch {
            setError("Invalid email or password.");
        } finally { setLoading(false); }
    };

    return (
        <div className="auth-card">
            <div className="auth-brand">📍 CivicWatch</div>
            <h2>Welcome Back</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label className="form-label">Password</label>
                    <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button type="submit" className="btn-primary btn-full" disabled={loading}>
                    {loading ? "Signing in…" : "Sign In"}
                </button>
            </form>
            <p className="auth-switch">Don't have an account? <Link to="/register">Sign Up</Link></p>
        </div>
    );
}

export default function Login() {
    return (
        <div className="auth-page">
            <div className="auth-split-layout">
                <div className="auth-graphic">
                    <div className="graphic-content">
                        <span className="graphic-icon">📍</span>
                        <h1>CivicWatch</h1>
                        <p>Sign in with Google or email. Two-factor authentication keeps your account secure.</p>
                    </div>
                </div>
                <div className="auth-form-wrapper">
                    {isClerkEnabled ? <ClerkLoginPanel /> : <LegacyLoginForm />}
                </div>
            </div>
        </div>
    );
}
