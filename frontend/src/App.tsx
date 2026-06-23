import React, { createContext, useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Provider } from "react-redux";
import { ClerkProvider } from "@clerk/clerk-react";
import Navbar from "./components/Navbar";
import ClerkAuthBridge from "./components/ClerkAuthBridge";
import Home from "./pages/Home";
import UserMap from "./pages/UserMap";
import AdminIssues from "./pages/AdminIssues";
import ReportSuccess from "./pages/ReportSuccess";
import MyReports from "./pages/MyReports";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { store } from "./store/store";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { setUser as setUserAction, setClerkSyncing as setClerkSyncingAction } from "./store/authSlice";
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
    /** Adapter over the Redux store — kept for backwards compatibility with existing consumers. */
    setUser: (user: User | null) => void;
    logout: () => void;
    setLogout: React.Dispatch<React.SetStateAction<() => void>>;
    /** True while Clerk session is being synced to backend JWT */
    clerkSyncing: boolean;
    setClerkSyncing: (syncing: boolean) => void;
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
    const navigate = useNavigate();
    const { setUser, setLogout } = React.useContext(AuthContext);
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
                    <Route path="/dashboard" element={<Navigate to="/map?report=1" replace />} />
                    <Route path="/report/success" element={<ReportSuccess />} />
                    <Route path="/my-reports" element={<MyReports />} />
                    <Route path="/login/*" element={<Login />} />
                    <Route path="/register/*" element={<Register />} />
                </Routes>
            </main>
        </>
    );
}

function AppInner() {
    const dispatch = useAppDispatch();
    const user = useAppSelector((state) => state.auth.user);
    const clerkSyncing = useAppSelector((state) => state.auth.clerkSyncing);
    const [logoutFn, setLogoutFn] = useState<() => void>(() => () => { });

    useEffect(() => {
        warmBackend();
    }, []);

    const setUser = useCallback(
        (next: User | null) => dispatch(setUserAction(next)),
        [dispatch],
    );
    const setClerkSyncing = useCallback(
        (syncing: boolean) => dispatch(setClerkSyncingAction(syncing)),
        [dispatch],
    );
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
        return (
            <Provider store={store}>
                <AppInner />
            </Provider>
        );
    }

    return (
        <Provider store={store}>
            <ClerkProvider
                publishableKey={CLERK_PUBLISHABLE_KEY}
                localization={clerkLocalization}
                afterSignOutUrl={CLERK_AFTER_SIGN_OUT_URL}
                signInFallbackRedirectUrl={CLERK_AFTER_AUTH_URL}
                signUpFallbackRedirectUrl={CLERK_AFTER_AUTH_URL}
            >
                <AppInner />
            </ClerkProvider>
        </Provider>
    );
}
