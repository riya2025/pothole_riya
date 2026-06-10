export const formatDate = (isoString: string | null): string => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export const issueColor = (type: string): string => {
    const map: Record<string, string> = {
        pothole: "#ef4444",
        garbage: "#f97316",
        streetlight: "#eab308",
        other: "#6366f1",
    };
    return map[type] || map.other;
};

export const issueIcon = (type: string): string => {
    const map: Record<string, string> = {
        pothole: "🕳️",
        garbage: "🗑️",
        streetlight: "💡",
        other: "⚠️",
    };
    return map[type] || "⚠️";
};

export const buildTweetUrl = (text: string): string => {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
};

export const parseJwt = (token: string): any => {
    try {
        return JSON.parse(atob(token.split(".")[1]));
    } catch {
        return null;
    }
};

export const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6_371_000;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dPhi = ((lat2 - lat1) * Math.PI) / 180;
    const dLambda = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dPhi / 2) ** 2 +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const filterWithinRadius = <T extends { lat: number | null; lng: number | null }>(
    items: T[],
    centerLat: number,
    centerLng: number,
    radiusM: number
): T[] =>
    items.filter(
        (item) =>
            item.lat != null &&
            item.lng != null &&
            haversineM(centerLat, centerLng, item.lat, item.lng) <= radiusM
    );

export const normalizeIssueType = (type: string | null | undefined): string =>
    (type || "other").trim().toLowerCase();

export type MapFocusPoint = { lat: number; lng: number; zoom?: number };

export function issuesWithCoords<T extends { lat: number | null; lng: number | null }>(
    issues: T[]
): T[] {
    return issues.filter((i) => i.lat != null && i.lng != null);
}

export const resolveMediaUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const fallback = typeof window !== "undefined" ? window.location.origin : "";
    const base = (process.env.REACT_APP_API_URL || fallback).replace(/\/$/, "");
    return `${base}${url.startsWith("/") ? url : `/${url}`}`;
};

export const getCurrentUser = (): any => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = parseJwt(token);
    if (!payload || payload.exp * 1000 < Date.now()) {
        localStorage.removeItem("token");
        return null;
    }
    return { id: payload.sub, ...payload };
};
