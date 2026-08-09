import asyncio
from fastapi import BackgroundTasks
from app.services.classification import (
    refine_report_from_media,
    _keyword_classify,
    is_placeholder_description,
)
from app.services.geocoding import reverse_geocode, get_cached_address
from app.repositories import issue_repo, report_repo
from app.database import sessions
from app.models.issue import Issue
from app.models.report import Report
from app.services.storage import save_report_media, media_kind
from app.services.video_frames import extract_video_frames


def get_city_from_coords(lat: float, lng: float) -> str:
    # Bangalore bounds approximately
    if 12.5 <= lat <= 13.5 and 77.0 <= lng <= 78.0:
        return "bangalore"
    # Vijayawada bounds approximately
    if 16.3 <= lat <= 16.7 and 80.4 <= lng <= 80.9:
        return "vijayawada"
    # Default to Hyderabad
    return "hyderabad"


async def finalize_report(
    *,
    city: str,
    issue_id: int,
    report_id: int,
    is_new: bool,
    lat: float,
    lng: float,
    description: str,
    image_bytes: bytes | None,
    image_filename: str | None,
    media_content_type: str | None = None,
    need_address: bool = False,
) -> None:
    """Background job: media upload, Groq vision (photo or video frames),
    reverse geocoding — then update stored rows.

    Videos are NOT stored whole: we pick the sharpest clear frame and upload
    that JPEG instead (cheaper storage, faster CDN, same evidence for the map).
    """

    kind = media_kind(image_filename, media_content_type) if image_bytes else None

    # For videos: extract one clear issue frame once, reuse for upload + vision.
    store_bytes = image_bytes
    store_filename = image_filename
    store_content_type = media_content_type
    classify_bytes = image_bytes
    classify_filename = image_filename
    classify_content_type = media_content_type

    if image_bytes and kind == "video":
        frames = await asyncio.to_thread(
            extract_video_frames,
            image_bytes,
            filename=image_filename,
            content_type=media_content_type,
            max_frames=1,
            max_width=1280,
        )
        if frames:
            store_bytes = frames[0]
            store_filename = "issue_frame.jpg"
            store_content_type = "image/jpeg"
            classify_bytes = frames[0]
            classify_filename = "issue_frame.jpg"
            classify_content_type = "image/jpeg"
            print(
                f"[finalize] video → single clear frame "
                f"({len(store_bytes)} bytes) instead of full clip"
            )
        else:
            print("[finalize] video frame extract failed; skipping full-video upload")
            store_bytes = None

    async def _upload():
        return (
            await save_report_media(store_bytes, store_filename, store_content_type)
            if store_bytes
            else None
        )

    async def _classify():
        # Only new issues need an accurate type; duplicates inherit the existing one.
        # Still refine the report description for video/photo when useful.
        if not classify_bytes and not is_new:
            return None
        # Skip vision for pure audio voice notes
        if kind == "audio":
            if not is_new:
                return None
            from app.services.classification import classify_issue

            issue_type, _ = await classify_issue(description)
            return {"category": issue_type, "description": "", "source": "text"}

        result = await refine_report_from_media(
            description,
            media_bytes=classify_bytes,
            media_filename=classify_filename,
            media_content_type=classify_content_type,
        )
        return result

    async def _geocode():
        return await reverse_geocode(lat, lng) if need_address else None

    image_url, refined, address = await asyncio.gather(
        _upload(), _classify(), _geocode()
    )

    db = sessions[city]()
    try:
        report = db.query(Report).filter(Report.id == report_id).first()
        if report:
            if image_url:
                report.image_url = image_url
            # Replace Quick Report placeholder text with vision description when available
            if (
                refined
                and refined.get("description")
                and is_placeholder_description(report.description)
            ):
                report.description = refined["description"]

        if is_new:
            issue = db.query(Issue).filter(Issue.id == issue_id).first()
            if issue:
                if refined and refined.get("category"):
                    issue.type = refined["category"]
                if address and not issue.address:
                    issue.address = address
        db.commit()
    finally:
        db.close()


async def handle_report(
    description: str,
    lat: float,
    lng: float,
    user_id: int | None,
    image_bytes: bytes | None,
    image_filename: str | None,
    media_content_type: str | None = None,
    background_tasks: BackgroundTasks | None = None,
) -> dict:
    # 1. Determine city and get session
    city = get_city_from_coords(lat, lng)
    db = sessions[city]()

    try:
        # 2. Instant keyword-based type + cached address so we can respond fast.
        #    Groq vision (incl. video frames), image upload and geocoding happen in
        #    the background (finalize_report) — the user never waits on them.
        keyword_type = _keyword_classify(description)
        cached_address = get_cached_address(lat, lng)

        # 3. Deduplication in the selected city database
        existing = issue_repo.find_nearby_issue(db, lat, lng, radius_meters=10.0)

        if existing:
            issue_repo.increment_report_count(db, existing)
            report = report_repo.create_report(
                db,
                issue_id=existing.id,
                user_id=user_id,
                image_url=None,
                description=description,
                latitude=lat,
                longitude=lng,
            )
            issue_id = existing.id
            is_new = False
            response_type = existing.type
            response_address = existing.address
        else:
            new_issue = issue_repo.create_issue(db, keyword_type, lat, lng, cached_address)
            report = report_repo.create_report(
                db,
                issue_id=new_issue.id,
                user_id=user_id,
                image_url=None,
                description=description,
                latitude=lat,
                longitude=lng,
            )
            issue_id = new_issue.id
            is_new = True
            response_type = keyword_type
            response_address = cached_address

        # 4. Hand off the slow work to the background (or inline if no task context).
        finalize_kwargs = dict(
            city=city,
            issue_id=issue_id,
            report_id=report.id,
            is_new=is_new,
            lat=lat,
            lng=lng,
            description=description,
            image_bytes=image_bytes,
            image_filename=image_filename,
            media_content_type=media_content_type,
            need_address=(is_new and cached_address is None),
        )
        if background_tasks is not None:
            background_tasks.add_task(finalize_report, **finalize_kwargs)
        else:
            await finalize_report(**finalize_kwargs)

        return {
            "issue_id": issue_id,
            "status": "attached" if not is_new else "created",
            "address": response_address,
            "type": response_type,
            "city": city,
            "latitude": lat,
            "longitude": lng,
            "classification_source": "keywords",
            "image_url": None,
        }
    finally:
        db.close()
