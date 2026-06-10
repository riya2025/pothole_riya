import { useAuth } from "@clerk/clerk-react";

/** Clerk session state — only use inside ClerkProvider (when isClerkEnabled). */
export function useClerkSession() {
    const { isSignedIn, isLoaded } = useAuth();
    return { isSignedIn: !!isSignedIn, isLoaded };
}
