"""
Export civic issues from the app database into a file that can be submitted to
GHMC (or any municipal body) manually or in bulk.

GHMC has no public API to push complaints into, so this produces a clean,
human- and machine-readable export (CSV or JSON) with a GHMC grievance category
mapped from each issue type.

Usage (from the backend/ directory):
    python export_issues.py                         # CSV -> exports/ghmc_issues_<timestamp>.csv
    python export_issues.py --format json           # JSON instead
    python export_issues.py --city hyderabad        # only one city
    python export_issues.py --type pothole          # only one issue type
    python export_issues.py out.csv                 # custom output path
"""
import argparse
import csv
import json
import os
from datetime import datetime

from app.database import sessions
from app.services.issue_service import get_city_from_coords
from app.repositories.issue_repo import get_all_issues, get_issue_lat_lng

# How our internal types map to GHMC grievance categories.
GHMC_CATEGORY = {
    "pothole": "Potholes / Road Repair",
    "garbage": "Open Dumping / Garbage",
    "streetlight": "Street Lights",
    "other": "Other Civic Issue",
}

EXPORT_FIELDS = [
    "issue_id",
    "city",
    "ghmc_category",
    "type",
    "status",
    "address",
    "latitude",
    "longitude",
    "report_count",
    "google_maps_url",
    "created_at",
]


def collect_issues(city_filter: str | None, type_filter: str | None) -> list[dict]:
    rows: list[dict] = []
    seen_urls: set[str] = set()
    seen_issue_ids: set[tuple[str, int]] = set()

    for name, Session in sessions.items():
        db = Session()
        try:
            url = str(db.bind.url)
            if url in seen_urls:
                continue
            seen_urls.add(url)

            for issue in get_all_issues(db):
                lat, lng = get_issue_lat_lng(issue)
                city = get_city_from_coords(lat, lng) if lat and lng else "hyderabad"

                if city_filter and city != city_filter:
                    continue
                if type_filter and issue.type != type_filter:
                    continue

                dedupe_key = (url, issue.id)
                if dedupe_key in seen_issue_ids:
                    continue
                seen_issue_ids.add(dedupe_key)

                maps_url = (
                    f"https://www.google.com/maps?q={lat},{lng}"
                    if lat is not None and lng is not None
                    else ""
                )
                rows.append({
                    "issue_id": issue.id,
                    "city": city,
                    "ghmc_category": GHMC_CATEGORY.get(issue.type, GHMC_CATEGORY["other"]),
                    "type": issue.type,
                    "status": issue.status,
                    "address": issue.address or "",
                    "latitude": lat,
                    "longitude": lng,
                    "report_count": issue.report_count,
                    "google_maps_url": maps_url,
                    "created_at": issue.created_at.isoformat() if issue.created_at else "",
                })
        finally:
            db.close()

    rows.sort(key=lambda r: r["created_at"], reverse=True)
    return rows


def write_csv(rows: list[dict], path: str) -> None:
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=EXPORT_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def write_json(rows: list[dict], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)


def main() -> None:
    parser = argparse.ArgumentParser(description="Export civic issues for GHMC submission.")
    parser.add_argument("output", nargs="?", help="Output file path (optional)")
    parser.add_argument("--format", choices=["csv", "json"], default="csv")
    parser.add_argument("--city", help="Filter by city (e.g. hyderabad)")
    parser.add_argument("--type", dest="type_filter", help="Filter by issue type")
    args = parser.parse_args()

    rows = collect_issues(args.city, args.type_filter)
    if not rows:
        print("No issues matched — nothing to export.")
        return

    os.makedirs("exports", exist_ok=True)
    if args.output:
        out_path = args.output
    else:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = os.path.join("exports", f"ghmc_issues_{stamp}.{args.format}")

    if args.format == "json":
        write_json(rows, out_path)
    else:
        write_csv(rows, out_path)

    print(f"Exported {len(rows)} issue(s) -> {out_path}")


if __name__ == "__main__":
    main()
