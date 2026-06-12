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
import ReportSuccess from "./pages/ReportSuccess";
import MyReports from "./pages/MyReports";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { restoreUserFromSession } from "./utils/authSession";
import { User } from "./types";
import {
    CLERK_PUBLISHABLE_KEY,
    isClerkEnabled,
    CLERK_AFTER_AUTH_URL,
    CLERK_AFTER_SIGN_OUT_URL,
    clerkLocalization,
} from "./config/clerk";
import API from "./services/api";
import "./index.css";

function warmBackend() {
    const base = process.env.REACT_APP_API_URL;
    if (!base) return;
    API.get("/").catch(() => undefined);
}

interface AuthContextType {
    user: User | null;
    setUser: React.Dispatch<React.SetStateAction<User | null>>;
    logout: () => void;
    setLogout: React.Dispatch<React.SetStateAction<() => void>>;
    /** True while Clerk session is being synced to backend JWT */
    clerkSyncing: boolean;
    setClerkSyncing: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    setUser: () => { },
    logout: () => { },
    setLogout: () => { },
    clerkSyncing: false,
    setClerkSyncing: () => { },
});

function AppRoutes() {
    const location = useLocation();
    const navigate = useNavigate();
    const { setUser, setLogout } = React.useContext(AuthContext);
    const isAuthPage = ["/login", "/register"].includes(location.pathname)
        || location.pathname.startsWith("/login/")
        || location.pathname.startsWith("/register/");

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
            {isClerkEnabled && <ClerkAuthBridge />}
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/map" element={<UserMap />} />
                    <Route path="/admin-issues" element={<AdminIssues />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/report/success" element={<ReportSuccess />} />
                    <Route path="/my-reports" element={<MyReports />} />
                    <Route path="/login/*" element={<Login />} />
                    <Route path="/register/*" element={<Register />} />
                </Routes>
                {!isAuthPage && <Footer />}
            </main>
        </>
    );
}

function AppInner() {
    const [user, setUser] = useState<User | null>(() => restoreUserFromSession());
    const [logoutFn, setLogoutFn] = useState<() => void>(() => () => { });
    const [clerkSyncing, setClerkSyncing] = useState(false);

    useEffect(() => {
        warmBackend();
    }, []);

    const logout = useCallback(() => logoutFn(), [logoutFn]);

    return (
        <AuthContext.Provider value={{
            user,
            setUser,
            logout,
            setLogout: setLogoutFn,
            clerkSyncing,
            setClerkSyncing,
        }}>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthContext.Provider>
    );
}

export default function App() {
    if (!isClerkEnabled) {
        return <AppInner />;
    }

    return (
        <ClerkProvider
            publishableKey={CLERK_PUBLISHABLE_KEY}
            localization={clerkLocalization}
            afterSignOutUrl={CLERK_AFTER_SIGN_OUT_URL}
            signInFallbackRedirectUrl={CLERK_AFTER_AUTH_URL}
            signUpFallbackRedirectUrl={CLERK_AFTER_AUTH_URL}
        >
            <AppInner />
        </ClerkProvider>
    );
}
