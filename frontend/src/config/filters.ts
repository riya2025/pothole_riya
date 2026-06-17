export const CITIES = [
    { value: "all", label: "All Cities" },
    { value: "hyderabad", label: "Hyderabad" },
    { value: "bangalore", label: "Bangalore" },
    { value: "vijayawada", label: "Vijayawada" },
] as const;

export type CityValue = (typeof CITIES)[number]["value"];

export const CITY_CENTERS: Record<string, [number, number]> = {
    all: [15.0, 78.0],
    hyderabad: [17.385, 78.4867],
    bangalore: [12.9716, 77.5946],
    vijayawada: [16.5062, 80.648],
};

/** Default zoom when a filter has no matching markers */
export const CITY_ZOOM: Record<string, number> = {
    all: 7,
    hyderabad: 11,
    bangalore: 11,
    vijayawada: 11,
};

export const ISSUE_TYPES = [
    { value: "all", label: "All Types" },
    { value: "pothole", label: "Potholes" },
    { value: "garbage", label: "Garbage" },
    { value: "streetlight", label: "Streetlights" },
    { value: "other", label: "Other" },
] as const;

export type IssueTypeValue = (typeof ISSUE_TYPES)[number]["value"];

const DETECTABLE_CITIES = ["hyderabad", "bangalore", "vijayawada"] as const;

/** Pick the nearest supported city from GPS; returns "all" if too far from all. */
export function detectNearestCity(
    lat: number,
    lng: number,
    maxDistanceM = 120_000
): CityValue {
    let nearest: CityValue = "all";
    let minDist = Infinity;

    for (const city of DETECTABLE_CITIES) {
        const [centerLat, centerLng] = CITY_CENTERS[city];
        const dLat = ((centerLat - lat) * Math.PI) / 180;
        const dLng = ((centerLng - lng) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((lat * Math.PI) / 180) *
            Math.cos((centerLat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const distM = 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        if (distM < minDist) {
            minDist = distM;
            nearest = city;
        }
    }

    return minDist <= maxDistanceM ? nearest : "all";
}
