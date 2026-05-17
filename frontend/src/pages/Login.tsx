import React, { useState, useContext, FormEvent } from "react";
import { login } from "../services/api";
import { AuthContext } from "../App";
import { parseJwt } from "../utils/helpers";
import { useNavigate, Link } from "react-router-dom";

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
            setUser({ id: payload?.sub, ...payload });
            navigate("/dashboard");
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
                        <p>Welcome back! Sign in to keep tracking your civic issues and helping the community.</p>
                    </div>
                </div>
                <div className="auth-form-wrapper">
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
                </div>
            </div>
        </div>
    );
}
