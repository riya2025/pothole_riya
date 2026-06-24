"""
Server-side verification of Clerk session tokens.

The frontend obtains a short-lived Clerk session JWT (via Clerk's `getToken()`)
and sends it to the backend. We verify that token's signature against Clerk's
public keys (JWKS) before trusting any identity claim. This prevents a caller
from minting a backend JWT for an arbitrary account without a real Clerk login.
"""
import time
import threading
from typing import Optional

import httpx
from jose import jwt, JWTError

from app.config import settings


# Cache the JWKS in memory so we don't fetch Clerk's public keys on every login.
_JWKS_TTL_SECONDS = 3600
_jwks_cache: dict = {"keys": None, "fetched_at": 0.0, "url": None}
_jwks_lock = threading.Lock()


class ClerkAuthError(Exception):
    """Raised when a Clerk session token cannot be verified."""


def _issuer() -> str:
    issuer = settings.CLERK_ISSUER.strip().rstrip("/")
    if not issuer:
        raise ClerkAuthError(
            "CLERK_ISSUER is not configured. Set it to your Clerk instance issuer "
            "(e.g. https://your-app.clerk.accounts.dev) to enable secure login."
        )
    return issuer


def _jwks_url() -> str:
    return f"{_issuer()}/.well-known/jwks.json"


def _get_jwks(force: bool = False) -> list:
    url = _jwks_url()
    now = time.time()
    with _jwks_lock:
        fresh = (
            _jwks_cache["keys"] is not None
            and _jwks_cache["url"] == url
            and (now - _jwks_cache["fetched_at"]) < _JWKS_TTL_SECONDS
        )
        if fresh and not force:
            return _jwks_cache["keys"]

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            keys = resp.json().get("keys", [])
    except (httpx.HTTPError, ValueError) as exc:
        raise ClerkAuthError(f"Unable to fetch Clerk signing keys: {exc}") from exc

    with _jwks_lock:
        _jwks_cache.update({"keys": keys, "fetched_at": now, "url": url})
    return keys


def _find_key(keys: list, kid: Optional[str]) -> Optional[dict]:
    for key in keys:
        if key.get("kid") == kid:
            return key
    return None


def verify_clerk_token(token: str) -> dict:
    """Verify a Clerk session JWT and return its claims.

    Raises ClerkAuthError if the token is missing, malformed, expired, signed by
    an unknown key, or issued by an untrusted issuer.
    """
    if not token:
        raise ClerkAuthError("Missing Clerk session token")

    try:
        kid = jwt.get_unverified_header(token).get("kid")
    except JWTError as exc:
        raise ClerkAuthError("Malformed Clerk session token") from exc

    keys = _get_jwks()
    key = _find_key(keys, kid)
    if key is None:
        # Key may have rotated since we last cached; refetch once.
        keys = _get_jwks(force=True)
        key = _find_key(keys, kid)
    if key is None:
        raise ClerkAuthError("Clerk session token signed by an unknown key")

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=_issuer(),
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise ClerkAuthError(f"Invalid Clerk session token: {exc}") from exc

    return claims
