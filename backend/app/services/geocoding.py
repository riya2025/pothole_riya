"""
Reverse geocoding service: converts lat/lng → human-readable address
using the free Nominatim API (no key required).
"""
import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
HEADERS = {"User-Agent": "CivicIssueReporter/1.0 (civic@example.com)"}


async def reverse_geocode(lat: float, lng: float) -> str:
    """Convert coordinates to a readable address string. Falls back to raw coordinates on failure."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={"lat": lat, "lon": lng, "format": "json"},
                headers=HEADERS,
            )
            resp.raise_for_status()
            data = resp.json()
            address = data.get("display_name", "")
            if address:
                return address
    except Exception as e:
        print(f"⚠️ Geocoding failed for ({lat}, {lng}): {e}")
    
    # Fallback to coordinates if geocoding fails or returns empty
    return f"Location: {lat:.5f}, {lng:.5f} (Address not found)"
