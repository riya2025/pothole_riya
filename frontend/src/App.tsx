import React, { createContext, useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ClerkAuthBridge from "./components/ClerkAuthBridge";
import Home from "./pages/Home";
import UserMap from "./pages/UserMap";
import AdminIssues from "./pages/AdminIssues";
import Dashboard from "./pages/Dashboard";
import MyReports from "./pages/MyReports";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { getCurrentUser } from "./utils/helpers";
import { User } from "./types";
import "./index.css";

const CLERK_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

interface AuthContextType {
    user: User | null;
    setUser: React.Dispatch<React.SetStateAction<User | null>>;
    logout: () => void;
    setLogout: React.Dispatch<React.SetStateAction<() => void>>;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    setUser: () => { },
    logout: () => { },
    setLogout: () => { },
});

function AppRoutes() {
    const location = useLocation();
    const navigate = useNavigate();
    const { setUser, setLogout } = React.useContext(AuthContext);
    const isAuthPage = ["/login", "/register"].includes(location.pathname);

    useEffect(() => {
        setLogout(() => () => {
            localStorage.removeItem("token");
            setUser(null);
            navigate("/");
        });
    }, [setUser, setLogout, navigate]);

    return (
        <>
            <Navbar />
            {CLERK_KEY && <ClerkAuthBridge />}
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/map" element={<UserMap />} />
                    <Route path="/admin-issues" element={<AdminIssues />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/my-reports" element={<MyReports />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                </Routes>
                {!isAuthPage && <Footer />}
            </main>
        </>
    );
}

function AppInner() {
    const [user, setUser] = useState<User | null>(null);
    const [logoutFn, setLogoutFn] = useState<() => void>(() => () => { });

    useEffect(() => {
        const u = getCurrentUser();
        if (u) setUser(u);
    }, []);

    const logout = useCallback(() => logoutFn(), [logoutFn]);

    return (
        <AuthContext.Provider value={{ user, setUser, logout, setLogout: setLogoutFn }}>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthContext.Provider>
    );
}

export default function App() {
    if (CLERK_KEY) {
        return (
            <ClerkProvider publishableKey={CLERK_KEY}>
                <AppInner />
            </ClerkProvider>
        );
    }
    return <AppInner />;
}
