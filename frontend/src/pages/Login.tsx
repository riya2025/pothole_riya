import React, { useState, useContext, FormEvent } from "react";
import { SignIn } from "@clerk/clerk-react";
import { login } from "../services/api";
import { AuthContext } from "../App";
import { parseJwt } from "../utils/helpers";
import { useNavigate, Link } from "react-router-dom";
import { isClerkEnabled, clerkAppearance, CLERK_AFTER_AUTH_URL } from "../config/clerk";

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
            navigate(CLERK_AFTER_AUTH_URL);
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
                        <p>Sign in with Google or email. Two-factor authentication keeps your account secure.</p>
                    </div>
                </div>
                <div className="auth-form-wrapper">
                    {isClerkEnabled ? (
                        <div className="clerk-auth-container">
                            <SignIn
                                routing="path"
                                path="/login"
                                signUpUrl="/register"
                                forceRedirectUrl={CLERK_AFTER_AUTH_URL}
                                fallbackRedirectUrl={CLERK_AFTER_AUTH_URL}
                                appearance={clerkAppearance}
                            />
                        </div>
                    ) : (
                        <div className="auth-card">
                            <div className="auth-brand">📍 CivicWatch</div>
                            <h2>Welcome Back</h2>
                            <p className="form-hint" style={{ textAlign: "center", marginBottom: "8px" }}>
                                Copy <code>frontend/.env.example</code> to <code>.env.local</code> and add your Clerk publishable key.
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
