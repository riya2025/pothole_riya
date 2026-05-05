export interface User {
    id: number;
    name: string;
    email: string;
}

export interface Issue {
    id: number;
    type: "pothole" | "garbage" | "streetlight" | "other";
    status: "active" | "resolved";
    address: string | null;
    report_count: number;
    lat: number | null;
    lng: number | null;
    city: string;
    created_at: string;
}

export interface Report {
    report_id: number;
    issue_id: number;
    type: string;
    status: string;
    address: string | null;
    report_count: number;
    lat: number | null;
    lng: number | null;
    image_url: string | null;
    description: string | null;
    created_at: string;
}
