import { User } from "../types";
import { parseJwt } from "./helpers";

const CLERK_ID_KEY = "clerk_user_id";
const PROFILE_KEY = "cw_user";

export function getStoredProfile(): User | null {
    try {
        const raw = localStorage.getItem(PROFILE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as User;
    } catch {
        return null;
    }
}

export function getStoredClerkId(): string | null {
    return localStorage.getItem(CLERK_ID_KEY);
}

export function isTokenValid(): boolean {
    const token = localStorage.getItem("token");
    if (!token) return false;
    const payload = parseJwt(token);
    if (!payload?.exp) return false;
    return payload.exp * 1000 > Date.now();
}

/** Reuse backend JWT when Clerk user id still matches — skips slow API sync. */
export function hasValidSessionForClerk(clerkId: string): boolean {
    return getStoredClerkId() === clerkId && isTokenValid();
}

export function persistAuthSession(user: User, clerkId: string, token: string) {
    localStorage.setItem("token", token);
    localStorage.setItem(CLERK_ID_KEY, clerkId);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
    localStorage.removeItem("token");
    localStorage.removeItem(CLERK_ID_KEY);
    localStorage.removeItem(PROFILE_KEY);
}

export function restoreUserFromSession(): User | null {
    if (!isTokenValid()) {
        clearAuthSession();
        return null;
    }
    return getStoredProfile();
}
