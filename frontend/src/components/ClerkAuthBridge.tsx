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
    const { setUser, setLogout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const syncingRef = useRef(false);

    useEffect(() => {
        setLogout(() => () => {
            localStorage.removeItem("token");
            setUser(null);
            signOut().catch(() => undefined).finally(() => navigate("/"));
        });
    }, [signOut, setUser, setLogout, navigate]);

    useEffect(() => {
        if (!isLoaded || !isSignedIn || !clerkUser || syncingRef.current) return;

        const email = clerkUser.primaryEmailAddress?.emailAddress;
        if (!email) return;

        const name = clerkUser.fullName || clerkUser.firstName || email.split("@")[0];

        syncingRef.current = true;
        clerkSync(name, email, clerkUser.id)
            .then((res) => {
                localStorage.setItem("token", res.data.access_token);
                const payload = parseJwt(res.data.access_token);
                setUser({
                    id: Number(payload?.sub),
                    name,
                    email,
                });
                if (location.pathname === "/login" || location.pathname === "/register") {
                    navigate(CLERK_AFTER_AUTH_URL, { replace: true });
                }
            })
            .catch((err) => {
                console.error("Clerk backend sync failed:", err);
            })
            .finally(() => {
                syncingRef.current = false;
            });
    }, [isLoaded, isSignedIn, clerkUser, setUser, navigate, location.pathname]);

    return null;
}
