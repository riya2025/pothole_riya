import React, { useState, FormEvent } from "react";
import { SignUp } from "@clerk/clerk-react";
import { register } from "../services/api";
import { useNavigate, Link } from "react-router-dom";

const CLERK_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

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
                        <p>Create your account with Google. Clerk supports two-factor verification to keep your Gmail sign-in secure.</p>
                    </div>
                </div>
                <div className="auth-form-wrapper">
                    {CLERK_KEY ? (
                        <div className="clerk-auth-container">
                            <SignUp
                                routing="hash"
                                signInUrl="/login"
                                forceRedirectUrl="/map"
                                appearance={{
                                    elements: {
                                        rootBox: { width: "100%" },
                                        card: {
                                            background: "rgba(23, 27, 40, 0.65)",
                                            border: "1px solid rgba(255,255,255,0.08)",
                                            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                                        },
                                        headerTitle: { color: "#F8FAFC" },
                                        headerSubtitle: { color: "#94A3B8" },
                                        socialButtonsBlockButton: {
                                            border: "1px solid rgba(255,255,255,0.08)",
                                            background: "rgba(255,255,255,0.02)",
                                        },
                                        formFieldLabel: { color: "#94A3B8" },
                                        formFieldInput: {
                                            background: "rgba(15, 18, 26, 0.8)",
                                            border: "1px solid rgba(255,255,255,0.08)",
                                            color: "#F8FAFC",
                                        },
                                        footerActionLink: { color: "#818cf8" },
                                    },
                                }}
                            />
                        </div>
                    ) : (
                        <div className="auth-card">
                            <div className="auth-brand">📍 CivicWatch</div>
                            <h2>Create Account</h2>
                            {success && <div className="alert alert-success">Account created! Redirecting to login…</div>}
                            {error && <div className="alert alert-error">{error}</div>}
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label className="form-label">Name</label>
                                    <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password</label>
                                    <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
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
