export const CITIES = [
    { value: "all", label: "All Cities" },
    { value: "hyderabad", label: "Hyderabad" },
    { value: "bangalore", label: "Bangalore" },
] as const;

export type CityValue = (typeof CITIES)[number]["value"];

export const CITY_CENTERS: Record<string, [number, number]> = {
    all: [17.385, 78.4867],
    hyderabad: [17.385, 78.4867],
    bangalore: [12.9716, 77.5946],
};

export const ISSUE_TYPES = [
    { value: "all", label: "All Types" },
    { value: "pothole", label: "Potholes" },
    { value: "garbage", label: "Garbage" },
    { value: "streetlight", label: "Streetlights" },
    { value: "other", label: "Other" },
] as const;

export type IssueTypeValue = (typeof ISSUE_TYPES)[number]["value"];
