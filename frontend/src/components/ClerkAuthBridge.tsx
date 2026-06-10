import { useEffect, useContext, useRef } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../App";
import { clerkSync } from "../services/api";
import { parseJwt } from "../utils/helpers";
import { CLERK_AFTER_AUTH_URL } from "../config/clerk";

export default function ClerkAuthBridge() {
    const { user: clerkUser, isSignedIn, isLoaded } = useUser();
    const { signOut } = useClerk();
    const { setUser, setLogout, setClerkSyncing } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const syncedClerkIdRef = useRef<string | null>(null);

    useEffect(() => {
        setLogout(() => () => {
            syncedClerkIdRef.current = null;
            localStorage.removeItem("token");
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
        const authPath =
            location.pathname === "/login"
            || location.pathname.startsWith("/login/")
            || location.pathname === "/register"
            || location.pathname.startsWith("/register/");

        setClerkSyncing(true);
        clerkSync(name, email, clerkUser.id)
            .then((res) => {
                localStorage.setItem("token", res.data.access_token);
                const payload = parseJwt(res.data.access_token);
                syncedClerkIdRef.current = clerkUser.id;
                setUser({
                    id: Number(payload?.sub),
                    name,
                    email,
                });
                if (authPath || location.pathname !== CLERK_AFTER_AUTH_URL) {
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
        setUser,
        setClerkSyncing,
        navigate,
        location.pathname,
    ]);

    return null;
}
