import React, { createContext, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import AdminIssues from "./pages/AdminIssues";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { getCurrentUser } from "./utils/helpers";
import { User } from "./types";
import "./index.css";

interface AuthContextType {
    user: User | null;
    setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    setUser: () => { },
});

export default function App() {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const u = getCurrentUser();
        if (u) setUser(u);
    }, []);

    return (
        <AuthContext.Provider value={{ user, setUser }}>
            <BrowserRouter>
                <Navbar />
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/admin-issues" element={<AdminIssues />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                    </Routes>
                </main>
            </BrowserRouter>
        </AuthContext.Provider>
    );
}
