"""
Bulk-import civic issues from a CSV file (e.g. GHMC / OpenCity / Telangana
open-data exports) into the app database.

The CSV needs latitude & longitude columns; type and address are optional.
Column names are auto-detected from common aliases (case-insensitive):

    type      : type, category, issue_type, service
    latitude  : latitude, lat, y
    longitude : longitude, lng, lon, long, x
    address   : address, location, place, name, locality

Rows are de-duplicated against existing issues using the same 10 m radius rule
the app uses for live reports, and routed to the correct city database via the
issue's coordinates.

Usage (from the backend/ directory):
    python import_issues.py data/ghmc.csv               # import
    python import_issues.py data/ghmc.csv --dry-run     # preview only
    python import_issues.py data/ghmc.csv --type garbage  # force a type for all rows
"""
import argparse
import csv
import sys

from app.database import sessions
from app.services.issue_service import get_city_from_coords
from app.repositories import issue_repo

VALID_TYPES = {"pothole", "garbage", "streetlight", "other"}

COLUMN_ALIASES = {
    "type": ["type", "category", "issue_type", "service", "servicecode"],
    "latitude": ["latitude", "lat", "y"],
    "longitude": ["longitude", "lng", "lon", "long", "x"],
    "address": ["address", "location", "place", "name", "locality"],
}


def _resolve_columns(fieldnames: list[str]) -> dict[str, str | None]:
    lookup = {name.lower().strip(): name for name in fieldnames}
    resolved: dict[str, str | None] = {}
    for key, aliases in COLUMN_ALIASES.items():
        resolved[key] = next((lookup[a] for a in aliases if a in lookup), None)
    return resolved


def _normalize_type(raw: str | None, forced: str | None) -> str:
    if forced:
        return forced
    if not raw:
        return "other"
    value = raw.strip().lower()
    if value in VALID_TYPES:
        return value
    # Light keyword mapping for free-text categories.
    if "pothole" in value or "road" in value:
        return "pothole"
    if "garbage" in value or "waste" in value or "dump" in value or "bin" in value:
        return "garbage"
    if "light" in value or "lamp" in value:
        return "streetlight"
    return "other"


def import_csv(path: str, forced_type: str | None, dry_run: bool) -> None:
    if forced_type and forced_type not in VALID_TYPES:
        print(f"Invalid --type '{forced_type}'. Choose one of: {', '.join(sorted(VALID_TYPES))}")
        sys.exit(1)

    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            print("CSV has no header row.")
            sys.exit(1)

        cols = _resolve_columns(reader.fieldnames)
        if not cols["latitude"] or not cols["longitude"]:
            print(f"Could not find latitude/longitude columns. Found headers: {reader.fieldnames}")
            sys.exit(1)

        print(f"Using columns: {cols}")

        created = skipped = duplicates = 0
        open_dbs: dict[str, object] = {}

        try:
            for line_no, row in enumerate(reader, start=2):
                lat_raw = (row.get(cols["latitude"]) or "").strip()
                lng_raw = (row.get(cols["longitude"]) or "").strip()
                try:
                    lat = float(lat_raw)
                    lng = float(lng_raw)
                except ValueError:
                    skipped += 1
                    continue
                if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                    skipped += 1
                    continue

                issue_type = _normalize_type(
                    row.get(cols["type"]) if cols["type"] else None, forced_type
                )
                address = (row.get(cols["address"]) if cols["address"] else None) or f"{lat:.5f}, {lng:.5f}"

                city = get_city_from_coords(lat, lng)
                if city not in sessions:
                    skipped += 1
                    continue

                if city not in open_dbs:
                    open_dbs[city] = sessions[city]()
                db = open_dbs[city]

                existing = issue_repo.find_nearby_issue(db, lat, lng, radius_meters=10.0)
                if existing:
                    duplicates += 1
                    continue

                if dry_run:
                    print(f"  + [{city}] {issue_type} @ {lat:.5f},{lng:.5f} — {address}")
                else:
                    issue_repo.create_issue(db, issue_type, lat, lng, address)
                created += 1

            if not dry_run:
                for db in open_dbs.values():
                    db.commit()
        except Exception as e:  # noqa: BLE001
            for db in open_dbs.values():
                db.rollback()
            print(f"ERROR: {e}")
            sys.exit(1)
        finally:
            for db in open_dbs.values():
                db.close()

        verb = "Would import" if dry_run else "Imported"
        print(
            f"\n{verb} {created} issue(s). "
            f"Skipped {skipped} invalid row(s), {duplicates} duplicate(s)."
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import civic issues from a CSV file.")
    parser.add_argument("csv_path", help="Path to the CSV file")
    parser.add_argument("--type", dest="forced_type", help="Force a single issue type for every row")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()
    import_csv(args.csv_path, args.forced_type, args.dry_run)
