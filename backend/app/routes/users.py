from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.issue import IssueOut
from app.repositories.report_repo import get_reports_by_user
from app.repositories.issue_repo import get_issue_lat_lng
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.issue import Issue

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/{user_id}/issues", response_model=List[dict])
def get_user_issues(
    user_id: int,
    current_user: User = Depends(get_current_user),
):
    from app.database import sessions
    
    all_reports = []
    seen_issues = set()
    
    for city in ["hyderabad", "bangalore", "vijayawada", "users"]:
        if city not in sessions: continue
        db = sessions[city]()
        try:
            reports = get_reports_by_user(db, user_id)
            for report in reports:
                if report.issue_id in seen_issues:
                    continue
                seen_issues.add(report.issue_id)
                
                issue: Issue = db.query(Issue).filter(Issue.id == report.issue_id).first()
                if not issue:
                    continue
                lat, lng = get_issue_lat_lng(issue)
                all_reports.append({
                    "report_id": report.id,
                    "issue_id": issue.id,
                    "type": issue.type,
                    "status": issue.status,
                    "address": issue.address,
                    "report_count": issue.report_count,
                    "lat": lat,
                    "lng": lng,
                    "image_url": report.image_url,
                    "description": report.description,
                    "created_at": report.created_at.isoformat(),
                    "city": city
                })
        finally:
            db.close()
            
    all_reports.sort(key=lambda x: x["created_at"], reverse=True)
    return all_reports
