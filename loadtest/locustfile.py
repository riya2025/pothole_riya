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
import os
import pathlib
import random

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

# Load the real sample photos from the repo's images/ folder, each paired with a
# matching description so reports are realistic per category.
_IMAGE_DIR = pathlib.Path(__file__).resolve().parent.parent / "images"
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
