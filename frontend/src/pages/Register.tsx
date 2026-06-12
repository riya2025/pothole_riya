import React, { useState, FormEvent } from "react";
import { SignUp } from "@clerk/clerk-react";
import { register } from "../services/api";
import { useNavigate, Link } from "react-router-dom";
import { isClerkEnabled, clerkAppearance, CLERK_AFTER_AUTH_URL } from "../config/clerk";
import { useClerkSession } from "../hooks/useClerkSession";
import ClerkSignedInGate from "../components/ClerkSignedInGate";

function ClerkRegisterPanel() {
    const { isLoaded: clerkLoaded } = useClerkSession();

    if (!clerkLoaded) {
        return (
            <div className="auth-card" style={{ textAlign: "center" }}>
                <div className="spinner" style={{ margin: "24px auto" }} />
            </div>
        );
    }

    return (
        <ClerkSignedInGate mode="register">
            <div className="clerk-auth-container">
                <SignUp
                    routing="path"
                    path="/register"
                    signInUrl="/login"
                    fallbackRedirectUrl={CLERK_AFTER_AUTH_URL}
                    appearance={clerkAppearance}
                />
            </div>
        </ClerkSignedInGate>
    );
}

export default function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true); setError("");
        try {
            await register(name, email, password);
            setSuccess(true);
            setTimeout(() => navigate("/login"), 1500);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Registration failed.");
        } finally { setLoading(false); }
    };

    return (
        <div className="auth-page">
            <div className="auth-split-layout">
                <div className="auth-graphic">
                    <div className="graphic-content">
                        <span className="graphic-icon">📍</span>
                        <h1>CivicWatch</h1>
                        <p>Create your account with Google or email. Start reporting civic issues in your city.</p>
                    </div>
                </div>
                <div className="auth-form-wrapper">
                    {isClerkEnabled ? (
                        <ClerkRegisterPanel />
                    ) : (
                        <div className="auth-card">
                            <div className="auth-brand">📍 CivicWatch</div>
                            <h2>Create Account</h2>
                            {success && <div className="alert alert-success">Account created! Redirecting to login…</div>}
                            {error && <div className="alert alert-error">{error}</div>}
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <input
                                        className="form-input"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Full name *"
                                        required
                                        aria-label="Full name"
                                    />
                                </div>
                                <div className="form-group">
                                    <input
                                        className="form-input"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Email address *"
                                        required
                                        aria-label="Email address"
                                    />
                                </div>
                                <div className="form-group">
                                    <input
                                        className="form-input"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Create a password *"
                                        required
                                        minLength={6}
                                        aria-label="Password"
                                    />
                                </div>
                                <button type="submit" className="btn-primary btn-full" disabled={loading}>
                                    {loading ? "Creating…" : "Create Account"}
                                </button>
                            </form>
                            <p className="auth-switch">Already have an account? <Link to="/login">Sign In</Link></p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
