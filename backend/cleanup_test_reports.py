"""
Delete ANONYMOUS load-test reports (and their now-orphaned issues) created by
loadtest/locustfile.py's report task.

Test reports are identified conservatively by ALL of:
  - user_id IS NULL (the load test submits anonymously), AND
  - description is one of the fixed load-test strings, AND
  - coordinates fall within ~330m of a load-test city center.

An issue is removed only if, after deleting the test reports, it has NO reports
left — so real issues (and seeded issues, which have their own/zero reports) are
not touched. Run from the backend dir:

    python cleanup_test_reports.py
"""
from app.database import sessions, SHARED_DB
from app.models.report import Report
from app.models.issue import Issue

TEST_DESCRIPTIONS = [
    "Large pothole in the middle of the road, dangerous for two-wheelers.",
    "Garbage pile not cleared for several days near the junction.",
    "Streetlight not working, the whole street is dark at night.",
    "Broken footpath and debris blocking the walkway.",
]

# Load-test base coordinates (locustfile CITY_COORDS) with a small radius that
# comfortably covers the ±0.002° jitter the test applies.
TEST_CENTERS = [
    (17.385000, 78.486700),  # hyderabad
    (12.971600, 77.594600),  # bangalore
    (16.506200, 80.648000),  # vijayawada
]
RADIUS_DEG = 0.003


def _near_test_center(lat, lng) -> bool:
    if lat is None or lng is None:
        return False
    return any(
        abs(lat - clat) <= RADIUS_DEG and abs(lng - clng) <= RADIUS_DEG
        for clat, clng in TEST_CENTERS
    )


def main() -> None:
    keys = ["users"] if SHARED_DB else ["users", "hyderabad", "bangalore", "vijayawada"]
    total_reports = 0
    total_issues = 0

    for key in keys:
        db = sessions[key]()
        try:
            candidates = (
                db.query(Report)
                .filter(Report.user_id.is_(None))
                .filter(Report.description.in_(TEST_DESCRIPTIONS))
                .all()
            )
            test_reports = [r for r in candidates if _near_test_center(r.latitude, r.longitude)]
            if not test_reports:
                continue

            affected_issue_ids = {r.issue_id for r in test_reports}
            for report in test_reports:
                db.delete(report)
            db.flush()
            total_reports += len(test_reports)

            for issue_id in affected_issue_ids:
                remaining = db.query(Report).filter(Report.issue_id == issue_id).count()
                if remaining == 0:
                    issue = db.query(Issue).filter(Issue.id == issue_id).first()
                    if issue:
                        db.delete(issue)
                        total_issues += 1

            db.commit()
        finally:
            db.close()

    print(f"Deleted {total_reports} test report(s) and {total_issues} orphaned test issue(s).")


if __name__ == "__main__":
    main()
