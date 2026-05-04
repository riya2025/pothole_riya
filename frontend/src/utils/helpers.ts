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
