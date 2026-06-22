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

# A minimal valid 1x1 JPEG so multipart uploads are well-formed when enabled.
_TINY_JPEG = base64.b64decode(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof"
    "Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB"
    "AAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q=="
)

# Fixed test coordinates per city. Reusing the same point lets the backend's
# 10m dedup attach reports to one issue instead of spawning many new ones.
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

    @tag("write")
    @task(1)
    def report_issue(self):
        city = random.choice(list(CITY_COORDS))
        lat, lng = CITY_COORDS[city]
        data = {
            "description": random.choice(DESCRIPTIONS),
            "latitude": str(lat),
            "longitude": str(lng),
        }
        files = None
        if SEND_IMAGE:
            files = {"image": ("loadtest.jpg", io.BytesIO(_TINY_JPEG), "image/jpeg")}
        self.client.post(
            "/api/issues/report",
            data=data,
            files=files,
            name="POST /api/issues/report",
        )
