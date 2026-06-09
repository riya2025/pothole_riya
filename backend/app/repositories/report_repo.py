from sqlalchemy.orm import Session
from app.models.report import Report
from typing import Optional, List


def create_report(
    db: Session,
    issue_id: int,
    user_id: Optional[int],
    image_url: Optional[str],
    description: Optional[str],
    latitude: float,
    longitude: float,
) -> Report:
    report = Report(
        issue_id=issue_id,
        user_id=user_id,
        image_url=image_url,
        description=description,
        latitude=latitude,
        longitude=longitude,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def get_reports_by_user(db: Session, user_id: int) -> List[Report]:
    return db.query(Report).filter(Report.user_id == user_id).order_by(Report.created_at.desc()).all()


def get_reports_by_issue(db: Session, issue_id: int) -> List[Report]:
    return db.query(Report).filter(Report.issue_id == issue_id).order_by(Report.created_at.desc()).all()
