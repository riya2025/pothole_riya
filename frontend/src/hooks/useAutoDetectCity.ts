import { useEffect, useRef, useState } from "react";
import { CityValue, detectNearestCity } from "../config/filters";

/**
 * Detect nearest supported city from browser GPS on first visit.
 * Stops auto-updating once the user manually picks a city.
 */
export function useAutoDetectCity(onDetected: (city: CityValue) => void) {
    const userPickedRef = useRef(false);
    const ranRef = useRef(false);
    const [detecting, setDetecting] = useState(true);
    const [detectedCity, setDetectedCity] = useState<CityValue | null>(null);

    useEffect(() => {
        if (ranRef.current) return;
        ranRef.current = true;

        if (!navigator.geolocation) {
            setDetecting(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (userPickedRef.current) {
                    setDetecting(false);
                    return;
                }
                const city = detectNearestCity(pos.coords.latitude, pos.coords.longitude);
                if (city !== "all") {
                    setDetectedCity(city);
                    onDetected(city);
                }
                setDetecting(false);
            },
            () => setDetecting(false),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 }
        );
    }, [onDetected]);

    const markUserPicked = () => {
        userPickedRef.current = true;
    };

    return { detecting, detectedCity, markUserPicked };
}
