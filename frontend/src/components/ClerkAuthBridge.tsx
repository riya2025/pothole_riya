import { useEffect, useContext } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { clerkSync } from "../services/api";
import { parseJwt } from "../utils/helpers";

export default function ClerkAuthBridge() {
    const { user: clerkUser, isSignedIn, isLoaded } = useUser();
    const { signOut } = useClerk();
    const { setUser, setLogout } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        setLogout(() => () => {
            localStorage.removeItem("token");
            setUser(null);
            signOut().catch(() => undefined).finally(() => navigate("/"));
        });
    }, [signOut, setUser, setLogout, navigate]);

    useEffect(() => {
        if (!isLoaded || !isSignedIn || !clerkUser) return;

        const email = clerkUser.primaryEmailAddress?.emailAddress;
        if (!email) return;

        const name = clerkUser.fullName || clerkUser.firstName || "User";

        clerkSync(name, email, clerkUser.id)
            .then((res) => {
                localStorage.setItem("token", res.data.access_token);
                const payload = parseJwt(res.data.access_token);
                setUser({
                    id: Number(payload?.sub),
                    name,
                    email,
                });
            })
            .catch(console.error);
    }, [isLoaded, isSignedIn, clerkUser, setUser]);

    return null;
}
