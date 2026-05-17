import React, { useState, FormEvent } from "react";
import { register } from "../services/api";
import { useNavigate, Link } from "react-router-dom";

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
                        <p>Join our community today to report issues, track resolutions, and make your city a better place.</p>
                    </div>
                </div>
                <div className="auth-form-wrapper">
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
                </div>
            </div>
        </div>
    );
}
