"""
Reverse geocoding service: converts lat/lng → human-readable address.

Primary provider: Nominatim (OpenStreetMap). Because the public Nominatim
instance aggressively rate-limits / blocks shared server IPs, we retry once and
then fall back to BigDataCloud's keyless reverse-geocode endpoint before finally
degrading to raw coordinates.
"""
import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
BIGDATACLOUD_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client"
HEADERS = {
    # Nominatim's usage policy requires an identifying User-Agent.
    "User-Agent": "CivicWatch/1.0 (https://github.com/riya2025/pothole_riya)",
    "Accept-Language": "en",
}

# Reports cluster in the same areas, so cache resolved addresses keyed by
# coordinates rounded to ~11m. This avoids repeat external calls (and dodges
# Nominatim's per-IP rate limit) for nearby/duplicate reports. In-memory only.
_GEOCODE_CACHE: dict[tuple[float, float], str] = {}
_GEOCODE_CACHE_MAX = 5000


def _cache_key(lat: float, lng: float) -> tuple[float, float]:
    return (round(lat, 4), round(lng, 4))


def get_cached_address(lat: float, lng: float) -> str | None:
    """Return an already-resolved address for these coords, if cached (no network)."""
    return _GEOCODE_CACHE.get(_cache_key(lat, lng))


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
    key = _cache_key(lat, lng)
    cached = _GEOCODE_CACHE.get(key)
    if cached is not None:
        return cached

    address: str | None = None
    # Short timeout so a slow/blocked provider can't dominate request latency.
    async with httpx.AsyncClient(timeout=5.0) as client:
        # 1. Nominatim (best street-level detail). Single attempt — on failure we
        #    fall straight through to the fallback rather than waiting to retry.
        try:
            address = await _try_nominatim(client, lat, lng)
        except Exception as e:
            print(f"⚠️ Nominatim failed for ({lat}, {lng}): {e}")

        # 2. Fallback provider (keyless, no IP bans, reliable city-level results).
        if not address:
            try:
                address = await _try_bigdatacloud(client, lat, lng)
            except Exception as e:
                print(f"⚠️ BigDataCloud failed for ({lat}, {lng}): {e}")

    # 3. Last resort: readable coordinates.
    result = address or f"{lat:.5f}, {lng:.5f}"

    # Cache only successful provider lookups (not the raw-coordinate fallback).
    if address and len(_GEOCODE_CACHE) < _GEOCODE_CACHE_MAX:
        _GEOCODE_CACHE[key] = result
    return result
