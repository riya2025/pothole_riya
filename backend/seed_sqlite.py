import sys
from sqlalchemy.orm import Session
from app.database import engine, create_tables
from app.models.user import User
from app.models.issue import Issue
from app.models.report import Report

def seed():
    # Make sure tables are created
    create_tables()

    print("Checking database constraints...")
    with Session(engine) as session:
        has_user = session.query(User).filter_by(email="demo@civic.app").first()
        if not has_user:
            demo_user = User(
                name="Demo User",
                email="demo@civic.app",
                hashed_password="$2b$12$demohashedpassword00000000000000000000000000000000000"
            )
            session.add(demo_user)
            print("Added demo user: demo@civic.app")

        if session.query(Issue).count() == 0:
            issues = [
                Issue(type="pothole", status="active", longitude=78.4867, latitude=17.3850, address="Banjara Hills, Hyderabad", report_count=3),
                Issue(type="garbage", status="active", longitude=78.4744, latitude=17.3660, address="Jubilee Hills, Hyderabad", report_count=1),
                Issue(type="streetlight", status="active", longitude=78.5000, latitude=17.4000, address="Secunderabad, Hyderabad", report_count=2)
            ]
            session.add_all(issues)
            print("Added mock civic issues.")
            
        try:
            session.commit()
            print("Database seeding completed successfully.")
        except Exception as e:
            session.rollback()
            print(f"Failed to seed data: {e}")

if __name__ == "__main__":
    seed()
