"""
Reverse geocoding service: converts lat/lng → human-readable address
using the free Nominatim API (no key required).
"""
import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
HEADERS = {"User-Agent": "CivicIssueReporter/1.0 (civic@example.com)"}


async def reverse_geocode(lat: float, lng: float) -> str:
    """Convert coordinates to a readable address string. Returns empty string on failure."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={"lat": lat, "lon": lng, "format": "json"},
                headers=HEADERS,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("display_name", "")
    except Exception:
        return ""
