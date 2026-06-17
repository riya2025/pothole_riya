"""
Reverse geocoding service: converts lat/lng → human-readable address.

Primary provider: Nominatim (OpenStreetMap). Because the public Nominatim
instance aggressively rate-limits / blocks shared server IPs, we retry once and
then fall back to BigDataCloud's keyless reverse-geocode endpoint before finally
degrading to raw coordinates.
"""
import asyncio
import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
BIGDATACLOUD_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client"
HEADERS = {
    # Nominatim's usage policy requires an identifying User-Agent.
    "User-Agent": "CivicWatch/1.0 (https://github.com/riya2025/pothole_riya)",
    "Accept-Language": "en",
}


async def _try_nominatim(client: httpx.AsyncClient, lat: float, lng: float) -> str | None:
    resp = await client.get(
        NOMINATIM_URL,
        params={
            "lat": lat,
            "lon": lng,
            "format": "json",
            "zoom": 18,
            "addressdetails": 1,
        },
        headers=HEADERS,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("error"):
        return None
    return data.get("display_name") or None


async def _try_bigdatacloud(client: httpx.AsyncClient, lat: float, lng: float) -> str | None:
    resp = await client.get(
        BIGDATACLOUD_URL,
        params={"latitude": lat, "longitude": lng, "localityLanguage": "en"},
    )
    resp.raise_for_status()
    data = resp.json()

    # Prefer the most specific, non-empty parts the API returns.
    parts = [
        data.get("locality"),
        data.get("city"),
        data.get("principalSubdivision"),
        data.get("countryName"),
    ]
    seen: set[str] = set()
    cleaned: list[str] = []
    for part in parts:
        if part and part not in seen:
            seen.add(part)
            cleaned.append(part)
    return ", ".join(cleaned) or None


async def reverse_geocode(lat: float, lng: float) -> str:
    """Convert coordinates to a readable address string. Falls back to raw coordinates on failure."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Nominatim with a single retry (handles transient 429/timeouts).
        for attempt in range(2):
            try:
                address = await _try_nominatim(client, lat, lng)
                if address:
                    return address
            except Exception as e:
                print(f"⚠️ Nominatim attempt {attempt + 1} failed for ({lat}, {lng}): {e}")
                if attempt == 0:
                    await asyncio.sleep(1.1)  # respect Nominatim's 1 req/sec policy

        # 2. Fallback provider (no key, reliable for city-level results).
        try:
            address = await _try_bigdatacloud(client, lat, lng)
            if address:
                return address
        except Exception as e:
            print(f"⚠️ BigDataCloud failed for ({lat}, {lng}): {e}")

    # 3. Last resort: readable coordinates.
    return f"{lat:.5f}, {lng:.5f}"
