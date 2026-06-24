import { useEffect, useContext, useRef } from "react";
import { useUser, useClerk, useAuth } from "@clerk/clerk-react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../App";
import { clerkSync } from "../services/api";
import { parseJwt } from "../utils/helpers";
import { CLERK_AFTER_AUTH_URL } from "../config/clerk";
import {
    clearAuthSession,
    hasValidSessionForClerk,
    hydrateUserFromToken,
    persistAuthSession,
} from "../utils/authSession";

export default function ClerkAuthBridge() {
    const { user: clerkUser, isSignedIn, isLoaded } = useUser();
    const { getToken } = useAuth();
    const { signOut } = useClerk();
    const { setUser, setLogout, setClerkSyncing } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const syncedClerkIdRef = useRef<string | null>(null);

    useEffect(() => {
        setLogout(() => () => {
            syncedClerkIdRef.current = null;
            clearAuthSession();
            setUser(null);
            signOut().catch(() => undefined).finally(() => navigate("/"));
        });
    }, [signOut, setUser, setLogout, navigate]);

    useEffect(() => {
        if (!isLoaded) return;

        if (!isSignedIn || !clerkUser) {
            syncedClerkIdRef.current = null;
            setClerkSyncing(false);
            return;
        }

        const email = clerkUser.primaryEmailAddress?.emailAddress;
        if (!email) return;

        if (syncedClerkIdRef.current === clerkUser.id) return;

        const name = clerkUser.fullName || clerkUser.firstName || email.split("@")[0];

        if (hasValidSessionForClerk(clerkUser.id, email)) {
            const nextUser = hydrateUserFromToken(email, name);
            if (nextUser) {
                const token = localStorage.getItem("token")!;
                persistAuthSession(nextUser, clerkUser.id, token);
                syncedClerkIdRef.current = clerkUser.id;
                setUser(nextUser);
                setClerkSyncing(false);
                return;
            }
        }

        const authPath =
            location.pathname === "/login"
            || location.pathname.startsWith("/login/")
            || location.pathname === "/register"
            || location.pathname.startsWith("/register/");

        setClerkSyncing(true);

        // The backend (Render free tier) can be cold-starting, so retry a few
        // times with a short backoff before giving up.
        const syncWithRetry = async () => {
            const maxAttempts = 4;
            let lastErr: unknown;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    const clerkToken = await getToken();
                    if (!clerkToken) {
                        throw new Error("Could not obtain Clerk session token");
                    }
                    return await clerkSync(name, email, clerkUser.id, clerkToken);
                } catch (err) {
                    lastErr = err;
                    if (attempt < maxAttempts) {
                        await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
                    }
                }
            }
            throw lastErr;
        };

        syncWithRetry()
            .then((res) => {
                const token = res.data.access_token;
                const payload = parseJwt(token);
                const nextUser = {
                    id: Number(payload?.sub),
                    name,
                    email,
                };
                persistAuthSession(nextUser, clerkUser.id, token);
                syncedClerkIdRef.current = clerkUser.id;
                setUser(nextUser);
                if (authPath) {
                    navigate(CLERK_AFTER_AUTH_URL, { replace: true });
                }
            })
            .catch((err) => {
                console.error("Clerk backend sync failed:", err);
                syncedClerkIdRef.current = null;
            })
            .finally(() => {
                setClerkSyncing(false);
            });
    }, [
        isLoaded,
        isSignedIn,
        clerkUser,
        getToken,
        setUser,
        setClerkSyncing,
        navigate,
        location.pathname,
    ]);

    return null;
}
