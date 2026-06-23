"""
Load test for the CivicWatch backend.

Simulates citizens browsing the map and (optionally) submitting reports.

Quick start
-----------
    pip install -r loadtest/requirements.txt

    # READ-ONLY test (safe) — 50 users against Render:
    locust -f loadtest/locustfile.py \
        --host https://civic-issue-api-612t.onrender.com \
        --tags read

    # then open http://localhost:8089 and set Users=50, Ramp up=5

    # Headless (no UI), read-only, 50 users for 2 minutes:
    locust -f loadtest/locustfile.py \
        --host https://civic-issue-api-612t.onrender.com \
        --tags read --headless -u 50 -r 5 -t 2m

    # Include report submissions (WRITES to prod DB) — opt-in:
    locust -f loadtest/locustfile.py \
        --host https://civic-issue-api-612t.onrender.com \
        --headless -u 50 -r 5 -t 2m

Env flags
---------
    LOAD_SEND_IMAGE=1   attach a tiny test image to reports (uses Groq + Cloudinary)

Cautions for production
-----------------------
- Report submissions write real rows and call Nominatim (1 req/s policy), Groq,
  and Cloudinary. Keep the write rate modest and clean up test rows afterwards.
- Reports use fixed coordinates per city so dedup attaches them to a handful of
  issues instead of creating thousands of new ones.
"""
import base64
import io
import json
import os
import pathlib
import random
import threading

from locust import HttpUser, task, tag, between

# Disable client-side TLS verification for the test run. On Windows, antivirus /
# corporate-proxy SSL inspection presents certs that aren't in any standard CA
# bundle, causing "CERTIFICATE_VERIFY_FAILED". We're load-testing our own known
# host, so skipping verification is safe and avoids false failures.
import urllib3

urllib3.disable_warnings()
_VERIFY_TLS = False

# Opt-in: attach an image to reports (exercises Groq vision + Cloudinary upload).
SEND_IMAGE = os.getenv("LOAD_SEND_IMAGE", "0") == "1"

# A minimal valid 1x1 JPEG used only as a fallback if no real images are found.
_TINY_JPEG = base64.b64decode(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof"
    "Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB"
    "AAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q=="
)

# Load the real sample photos, each paired with a matching description so reports
# are realistic per category. Defaults to the repo's images/ folder, but can be
# overridden with LOAD_IMAGE_DIR (useful when images live outside the repo).
_IMAGE_DIR = pathlib.Path(
    os.getenv("LOAD_IMAGE_DIR")
    or (pathlib.Path(__file__).resolve().parent.parent / "images")
)
_REAL_IMAGES: list[tuple[str, str, str, bytes]] = []
for _fname, _mime, _desc in [
    ("pothole.png", "image/png", "Large pothole in the middle of the road, dangerous for two-wheelers."),
    ("garbage.jpeg", "image/jpeg", "Garbage pile not cleared for several days near the junction."),
    ("streetlight.png", "image/png", "Streetlight not working, the whole street is dark at night."),
]:
    _path = _IMAGE_DIR / _fname
    if _path.exists():
        _REAL_IMAGES.append((_fname, _mime, _desc, _path.read_bytes()))

# Base coordinates per city. We jitter around these so each report is a distinct
# NEW issue (>10m apart) — forcing the backend to run Groq vision classification
# + Cloudinary upload in the background for every report.
CITY_COORDS = {
    "hyderabad": (17.385000, 78.486700),
    "bangalore": (12.971600, 77.594600),
    "vijayawada": (16.506200, 80.648000),
}

DESCRIPTIONS = [
    "Large pothole in the middle of the road, dangerous for two-wheelers.",
    "Garbage pile not cleared for several days near the junction.",
    "Streetlight not working, the whole street is dark at night.",
    "Broken footpath and debris blocking the walkway.",
]

# ── Auth / user-flow test config ─────────────────────────────────────────────
# A single seeded account is used to exercise login + "My Reports". clerk-sync
# and register draw from a small capped pool of emails so we never create more
# than ~POOL test users (keeps DB pollution minimal and cleanup easy).
SEED_EMAIL = "loadtest_seed@example.com"
SEED_PASSWORD = "LoadTest123!"
SEED_NAME = "Load Test Seed"
EMAIL_POOL_SIZE = 50

# Shared, one-time-initialized auth state (token + user id for the seed account).
_auth_lock = threading.Lock()
_auth_state: dict = {"token": None, "user_id": None, "ready": False}


class CivicUser(HttpUser):
    # Realistic think-time between actions.
    wait_time = between(1, 4)

    # Shared across users so report-detail calls hit real IDs.
    issue_ids: list[int] = []

    def on_start(self):
        """Warm the instance and collect some issue IDs for detail requests."""
        self.client.verify = _VERIFY_TLS
        try:
            resp = self.client.get("/api/issues", name="GET /api/issues")
            if resp.ok:
                data = resp.json()
                CivicUser.issue_ids = [item["id"] for item in data][:50]
        except Exception:
            pass

    @tag("read")
    @task(10)
    def browse_issues(self):
        self.client.get("/api/issues", name="GET /api/issues")

    @tag("read")
    @task(5)
    def issue_detail(self):
        if not CivicUser.issue_ids:
            return
        issue_id = random.choice(CivicUser.issue_ids)
        self.client.get(f"/api/issues/{issue_id}", name="GET /api/issues/{id}")

    @tag("read")
    @task(2)
    def health(self):
        self.client.get("/", name="GET /")

    def _pick_image(self):
        """Return (filename, mime, description, bytes) for a real photo, or a
        tiny-JPEG fallback paired with a generic description."""
        if _REAL_IMAGES:
            return random.choice(_REAL_IMAGES)
        return ("loadtest.jpg", "image/jpeg", random.choice(DESCRIPTIONS), _TINY_JPEG)

    @tag("write")
    @task(1)
    def report_issue(self):
        city = random.choice(list(CITY_COORDS))
        base_lat, base_lng = CITY_COORDS[city]
        # Jitter ~±200m so each report is a distinct new issue (>10m dedup radius).
        lat = base_lat + random.uniform(-0.002, 0.002)
        lng = base_lng + random.uniform(-0.002, 0.002)

        fname, mime, desc, content = self._pick_image()
        data = {
            "description": desc,
            "latitude": str(lat),
            "longitude": str(lng),
        }
        files = None
        if SEND_IMAGE:
            files = {"image": (fname, io.BytesIO(content), mime)}
        self.client.post(
            "/api/issues/report",
            data=data,
            files=files,
            name="POST /api/issues/report",
        )

    @tag("analyze")
    @task(1)
    def analyze_image(self):
        # Exercises the Groq vision endpoint (no DB write).
        fname, mime, _desc, content = self._pick_image()
        files = {"image": (fname, io.BytesIO(content), mime)}
        self.client.post(
            "/api/issues/analyze",
            files=files,
            name="POST /api/issues/analyze",
        )

    # ── Auth + user flows ────────────────────────────────────────────────────
    def _ensure_seed_user(self):
        """Create (once) and log in the seed account; cache token + user id."""
        if _auth_state["ready"]:
            return
        with _auth_lock:
            if _auth_state["ready"]:
                return
            with self.client.post(
                "/api/auth/register",
                json={"name": SEED_NAME, "email": SEED_EMAIL, "password": SEED_PASSWORD},
                name="POST /api/auth/register [seed]",
                catch_response=True,
            ) as r:
                if r.status_code == 201:
                    _auth_state["user_id"] = r.json().get("id")
                    r.success()
                elif r.status_code == 400:  # already registered — expected
                    r.success()
            login = self.client.post(
                "/api/auth/login",
                data={"username": SEED_EMAIL, "password": SEED_PASSWORD},
                name="POST /api/auth/login [seed]",
            )
            if login.ok:
                token = login.json().get("access_token")
                _auth_state["token"] = token
                if _auth_state["user_id"] is None and token:
                    try:
                        payload = token.split(".")[1]
                        payload += "=" * (-len(payload) % 4)
                        decoded = json.loads(base64.urlsafe_b64decode(payload))
                        _auth_state["user_id"] = int(decoded["sub"])
                    except Exception:
                        pass
            _auth_state["ready"] = True

    @tag("login")
    @task(1)
    def login(self):
        self._ensure_seed_user()
        self.client.post(
            "/api/auth/login",
            data={"username": SEED_EMAIL, "password": SEED_PASSWORD},
            name="POST /api/auth/login",
        )

    @tag("clerksync")
    @task(1)
    def clerk_sync(self):
        n = random.randint(0, EMAIL_POOL_SIZE - 1)
        self.client.post(
            "/api/auth/clerk-sync",
            json={
                "name": f"Clerk User {n}",
                "email": f"loadtest_clerk_{n}@example.com",
                "clerk_id": f"load_clerk_{n}",
            },
            name="POST /api/auth/clerk-sync",
        )

    @tag("register")
    @task(1)
    def register(self):
        n = random.randint(0, EMAIL_POOL_SIZE - 1)
        with self.client.post(
            "/api/auth/register",
            json={
                "name": f"Reg User {n}",
                "email": f"loadtest_reg_{n}@example.com",
                "password": SEED_PASSWORD,
            },
            name="POST /api/auth/register",
            catch_response=True,
        ) as r:
            # 201 = created, 400 = already exists (both are valid fast paths).
            if r.status_code in (201, 400):
                r.success()

    @tag("myreports")
    @task(1)
    def my_reports(self):
        self._ensure_seed_user()
        token = _auth_state.get("token")
        user_id = _auth_state.get("user_id")
        if not token or user_id is None:
            return
        self.client.get(
            f"/api/users/{user_id}/issues",
            headers={"Authorization": f"Bearer {token}"},
            name="GET /api/users/{id}/issues",
        )
