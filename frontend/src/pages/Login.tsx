import React, { useState, useContext, FormEvent } from "react";
import { SignIn } from "@clerk/clerk-react";
import { login } from "../services/api";
import { AuthContext } from "../App";
import { parseJwt } from "../utils/helpers";
import { useNavigate, Link } from "react-router-dom";

const CLERK_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

export default function Login() {
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
            localStorage.setItem("token", res.data.access_token);
            const payload = parseJwt(res.data.access_token);
            setUser({ id: Number(payload?.sub), name: email.split("@")[0], email });
            navigate("/map");
        } catch {
            setError("Invalid email or password.");
        } finally { setLoading(false); }
    };

    return (
        <div className="auth-page">
            <div className="auth-split-layout">
                <div className="auth-graphic">
                    <div className="graphic-content">
                        <span className="graphic-icon">📍</span>
                        <h1>CivicWatch</h1>
                        <p>Sign in with Google for secure access. Enable two-factor authentication in your account settings for extra protection.</p>
                    </div>
                </div>
                <div className="auth-form-wrapper">
                    {CLERK_KEY ? (
                        <div className="clerk-auth-container">
                            <SignIn
                                routing="hash"
                                signUpUrl="/register"
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
                            <h2>Welcome Back</h2>
                            <p className="form-hint" style={{ textAlign: "center", marginBottom: "8px" }}>
                                Add REACT_APP_CLERK_PUBLISHABLE_KEY for Google OAuth & 2FA
                            </p>
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
                    )}
                </div>
            </div>
        </div>
    );
}
