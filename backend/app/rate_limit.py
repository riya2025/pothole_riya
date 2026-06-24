"""
Shared rate limiter.

Defined in its own module so both `main.py` (to register the limiter + error
handler) and the route modules (to apply per-endpoint limits) can import it
without creating a circular import.
"""
from slowapi import Limiter
from starlette.requests import Request


def _client_ip(request: Request) -> str:
    """Best-effort client IP. On Render (and most hosts) traffic arrives via a
    proxy, so prefer the first X-Forwarded-For entry over the socket peer."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "anonymous"


limiter = Limiter(key_func=_client_ip)
