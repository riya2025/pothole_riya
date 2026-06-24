import axios from "axios";

const API = axios.create({
    baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000",
});

API.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const register = (name: string, email: string, password: string) =>
    API.post("/api/auth/register", { name, email, password });

export const login = (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    return API.post("/api/auth/login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
};

export const getAllIssues = () => API.get("/api/issues");

export const getIssueDetail = (issueId: number) => API.get(`/api/issues/${issueId}`);

export const clerkSync = (
    name: string,
    email: string,
    clerkId: string,
    clerkToken: string,
) =>
    API.post(
        "/api/auth/clerk-sync",
        { name, email, clerk_id: clerkId },
        { headers: { Authorization: `Bearer ${clerkToken}` } },
    );

export const reportIssue = (formData: FormData) =>
    API.post("/api/issues/report", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

export const analyzeIssueImage = (formData: FormData) =>
    API.post("/api/issues/analyze", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

export const getUserIssues = (userId: number) =>
    API.get(`/api/users/${userId}/issues`);

export default API;
