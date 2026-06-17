"""
One-off maintenance script: remove issues whose address is the old
"... (Address not found)" geocoding fallback, along with their reports.

Usage (from the backend/ directory):
    python cleanup_addresses.py            # delete matching issues
    python cleanup_addresses.py --dry-run  # only show what would be deleted

It uses the same database configuration as the app (POSTGRES_URL from .env,
falling back to the local SQLite databases).
"""
import sys

from app.database import sessions
from app.models.issue import Issue
from app.models.report import Report

# Old fallbacks that should be cleaned up.
PATTERNS = ["%Address not found%", "%(Address not found)%"]


def cleanup(dry_run: bool = False) -> None:
    seen_urls: set[str] = set()
    total = 0

    for name, Session in sessions.items():
        db = Session()
        try:
            url = str(db.bind.url)
            # In Postgres mode every "city" session points at the same DB, so
            # only process each unique database once.
            if url in seen_urls:
                continue
            seen_urls.add(url)

            query = db.query(Issue)
            condition = None
            for pattern in PATTERNS:
                clause = Issue.address.ilike(pattern)
                condition = clause if condition is None else (condition | clause)
            bad_issues = query.filter(condition).all()

            if not bad_issues:
                print(f"[{name}] No 'Address not found' issues.")
                continue

            ids = [i.id for i in bad_issues]
            print(f"[{name}] Found {len(ids)} matching issue(s): {ids}")
            for issue in bad_issues:
                print(f"    #{issue.id}: {issue.address!r}")

            if dry_run:
                continue

            # Delete dependent reports first (safe even when FK cascade is off).
            db.query(Report).filter(Report.issue_id.in_(ids)).delete(synchronize_session=False)
            db.query(Issue).filter(Issue.id.in_(ids)).delete(synchronize_session=False)
            db.commit()
            total += len(ids)
            print(f"[{name}] Deleted {len(ids)} issue(s).")
        except Exception as e:  # noqa: BLE001
            db.rollback()
            print(f"[{name}] ERROR: {e}")
        finally:
            db.close()

    if dry_run:
        print("\nDry run complete — nothing was deleted.")
    else:
        print(f"\nDone. Removed {total} issue(s) with 'Address not found'.")


if __name__ == "__main__":
    cleanup(dry_run="--dry-run" in sys.argv)
