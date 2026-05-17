from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi import HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.schemas.issue import IssueReportResponse, IssueOut
from app.repositories.issue_repo import get_all_issues, get_issue_lat_lng
from app.services.issue_service import handle_report
from app.auth.dependencies import get_current_user, get_optional_user
from app.models.user import User

router = APIRouter(prefix="/api/issues", tags=["issues"])


@router.post("/report", response_model=IssueReportResponse, status_code=201)
async def report_issue(
    description: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    image: Optional[UploadFile] = File(None),
    current_user: Optional[User] = Depends(get_optional_user),
):
    image_bytes = await image.read() if image else None
    image_filename = image.filename if image else None

    result = await handle_report(
        description=description,
        lat=latitude,
        lng=longitude,
        user_id=current_user.id if current_user else None,
        image_bytes=image_bytes,
        image_filename=image_filename,
    )
    return result


@router.get("", response_model=List[IssueOut])
def get_issues():
    from app.database import sessions
    from app.services.issue_service import get_city_from_coords
    
    all_issues = []
    
    # Since Postgres combines all cities into one DB, we just query once
    db = sessions["users"]()
    try:
        issues = get_all_issues(db)
        for issue in issues:
            lat, lng = get_issue_lat_lng(issue)
            # Dynamically attach the city based on the issue's coordinates
            city = get_city_from_coords(lat, lng) if lat and lng else "hyderabad"
            
            all_issues.append(
                IssueOut(
                    id=issue.id,
                    type=issue.type,
                    status=issue.status,
                    address=issue.address,
                    report_count=issue.report_count,
                    lat=lat,
                    lng=lng,
                    city=city,
                    created_at=issue.created_at,
                )
            )
    finally:
        db.close()
            
    # Sort by created_at descending if needed
    all_issues.sort(key=lambda x: x.created_at, reverse=True)
    return all_issues
