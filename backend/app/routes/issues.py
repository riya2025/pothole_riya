from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile, Request
from fastapi import HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.schemas.issue import IssueReportResponse, IssueOut, IssueDetailOut, ReportOut
from app.repositories.issue_repo import get_all_issues, get_issue_lat_lng
from app.repositories.report_repo import get_reports_by_issue
from app.models.issue import Issue as IssueModel
from app.services.issue_service import handle_report
from app.services.classification import analyze_issue_photo, analyze_issue_video
from app.services.storage import media_kind
from app.auth.dependencies import get_current_user, get_optional_user
from app.models.user import User
from app.rate_limit import limiter

router = APIRouter(prefix="/api/issues", tags=["issues"])

# Upload limits: reject oversized or unsupported files before processing.
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_VIDEO_BYTES = 25 * 1024 * 1024  # 25 MB — short clips only
MAX_AUDIO_BYTES = 5 * 1024 * 1024   # 5 MB — ~15s voice notes
ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}
ALLOWED_VIDEO_TYPES = {
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-m4v",
}
ALLOWED_AUDIO_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "audio/ogg",
    "audio/aac",
}


def _max_bytes_for_kind(kind: str) -> int:
    if kind == "video":
        return MAX_VIDEO_BYTES
    if kind == "audio":
        return MAX_AUDIO_BYTES
    return MAX_IMAGE_BYTES


def _validate_media_upload(upload: UploadFile) -> str:
    """Validate image/video/audio upload. Returns media kind."""
    content_type = (upload.content_type or "").lower().split(";")[0].strip()
    kind = media_kind(upload.filename, content_type)

    allowed = ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES | ALLOWED_AUDIO_TYPES
    # Some browsers send empty or generic MIME for MediaRecorder blobs — fall
    # back to filename-based kind when content_type is missing/octet-stream.
    if content_type and content_type not in allowed and content_type != "application/octet-stream":
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file type '{content_type}'. "
                "Upload a photo, short video (mp4/webm), or voice note (webm/m4a/wav)."
            ),
        )

    max_bytes = _max_bytes_for_kind(kind)
    if upload.size is not None and upload.size > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {max_bytes // (1024 * 1024)} MB for {kind}.",
        )
    return kind


def _validate_image_upload(image: UploadFile) -> None:
    """Reject uploads that aren't images or exceed the size limit."""
    content_type = (image.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{content_type or 'unknown'}'. Upload a JPEG, PNG, WebP, or HEIC image.",
        )
    if image.size is not None and image.size > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large. Maximum size is {MAX_IMAGE_BYTES // (1024 * 1024)} MB.",
        )


@router.post("/analyze")
@limiter.limit("20/minute")
async def analyze_media(
    request: Request,
    image: Optional[UploadFile] = File(None),
    media: Optional[UploadFile] = File(None),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Analyze a photo or short video and suggest category + description (no DB write).

    Videos: extract a sharp frame, then run the same Groq vision path as photos.
    Accepts either `image` (photo) or `media` (photo/video).
    """
    upload = media or image
    if upload is None:
        raise HTTPException(400, detail="Upload an image or video as 'image' or 'media'.")

    kind = _validate_media_upload(upload)
    if kind == "audio":
        raise HTTPException(
            400,
            detail="Voice notes can't be vision-analyzed. Add a short text description instead.",
        )

    file_bytes = await upload.read()
    if not file_bytes:
        raise HTTPException(400, detail="Empty media upload")

    max_bytes = _max_bytes_for_kind(kind)
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {max_bytes // (1024 * 1024)} MB for {kind}.",
        )

    content_type = (upload.content_type or "").lower().split(";")[0].strip() or None
    if kind == "video":
        result = await analyze_issue_video(
            file_bytes,
            video_filename=upload.filename,
            content_type=content_type,
        )
        if not result.get("description") and result.get("source") == "no_frames":
            raise HTTPException(
                422,
                detail="Could not read frames from this video. Try MP4/WebM or upload a photo.",
            )
        return result

    return await analyze_issue_photo(file_bytes, upload.filename)


@router.post("/report", response_model=IssueReportResponse, status_code=201)
@limiter.limit("30/minute")
async def report_issue(
    request: Request,
    background_tasks: BackgroundTasks,
    description: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    analyzed_category: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    media: Optional[UploadFile] = File(None),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Create/attach a report. Optional analyzed_category from /analyze skips a second VLM call."""
    upload = media or image
    media_content_type = None
    image_bytes = None
    image_filename = None

    if upload is not None:
        kind = _validate_media_upload(upload)
        media_content_type = (upload.content_type or "").lower().split(";")[0].strip() or None
        image_bytes = await upload.read()
        image_filename = upload.filename
        if not image_bytes:
            raise HTTPException(400, detail="Empty media upload")
        max_bytes = _max_bytes_for_kind(kind)
        if len(image_bytes) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {max_bytes // (1024 * 1024)} MB for {kind}.",
            )

    result = await handle_report(
        description=description,
        lat=latitude,
        lng=longitude,
        user_id=current_user.id if current_user else None,
        image_bytes=image_bytes,
        image_filename=image_filename,
        media_content_type=media_content_type,
        background_tasks=background_tasks,
        analyzed_category=analyzed_category,
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


@router.get("/{issue_id}", response_model=IssueDetailOut)
def get_issue_detail(issue_id: int):
    from app.database import sessions
    from app.services.issue_service import get_city_from_coords

    db = sessions["users"]()
    try:
        issue = db.query(IssueModel).filter(IssueModel.id == issue_id).first()
        if not issue:
            raise HTTPException(404, detail="Issue not found")

        lat, lng = get_issue_lat_lng(issue)
        city = get_city_from_coords(lat, lng) if lat and lng else "hyderabad"
        reports = get_reports_by_issue(db, issue_id)

        return IssueDetailOut(
            id=issue.id,
            type=issue.type,
            status=issue.status,
            address=issue.address,
            report_count=issue.report_count,
            lat=lat,
            lng=lng,
            city=city,
            created_at=issue.created_at,
            reports=[ReportOut.model_validate(r) for r in reports],
        )
    finally:
        db.close()
