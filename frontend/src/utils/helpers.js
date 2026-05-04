/** Format a date string to a readable format */
export const formatDate = (isoString) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

/** Return a CSS color class for each issue type */
export const issueColor = (type) => {
    const map = {
        pothole: "#ef4444",
        garbage: "#f97316",
        streetlight: "#eab308",
        other: "#6366f1",
    };
    return map[type] || map.other;
};

/** Return an emoji icon for each issue type */
export const issueIcon = (type) => {
    const map = {
        pothole: "🕳️",
        garbage: "🗑️",
        streetlight: "💡",
        other: "⚠️",
    };
    return map[type] || "⚠️";
};

/** Build a Twitter share URL */
export const buildTweetUrl = (text) => {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
};

/** Parse JWT payload without full validation */
export const parseJwt = (token) => {
    try {
        return JSON.parse(atob(token.split(".")[1]));
    } catch {
        return null;
    }
};

/** Get current user from localStorage token */
export const getCurrentUser = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = parseJwt(token);
    if (!payload || payload.exp * 1000 < Date.now()) {
        localStorage.removeItem("token");
        return null;
    }
    return { id: payload.sub, ...payload };
};
