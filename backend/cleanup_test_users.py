"""
Delete load-test accounts (and any of their reports) from the database.

Targets emails matching 'loadtest_%@example.com' — i.e. the seed, clerk-sync,
and register users created by loadtest/locustfile.py. Run from the backend dir:

    python cleanup_test_users.py
"""
from app.database import sessions, SHARED_DB
from app.models.user import User
from app.models.report import Report

EMAIL_LIKE = "loadtest_%@example.com"


def main() -> None:
    keys = ["users"] if SHARED_DB else ["users", "hyderabad", "bangalore", "vijayawada"]
    total_users = 0
    total_reports = 0

    for key in keys:
        db = sessions[key]()
        try:
            users = db.query(User).filter(User.email.like(EMAIL_LIKE)).all()
            ids = [u.id for u in users]
            if not ids:
                continue
            # Remove dependent reports first to respect foreign keys.
            total_reports += (
                db.query(Report)
                .filter(Report.user_id.in_(ids))
                .delete(synchronize_session=False)
            )
            total_users += (
                db.query(User)
                .filter(User.id.in_(ids))
                .delete(synchronize_session=False)
            )
            db.commit()
        finally:
            db.close()

    print(f"Deleted {total_users} test user(s) and {total_reports} of their report(s).")


if __name__ == "__main__":
    main()
