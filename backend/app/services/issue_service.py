import asyncio
from fastapi import BackgroundTasks
from app.services.classification import classify_issue, _keyword_classify
from app.services.geocoding import reverse_geocode, get_cached_address
from app.repositories import issue_repo, report_repo
from app.database import sessions
from app.models.issue import Issue
from app.models.report import Report
from app.services.storage import save_report_image


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
    need_address: bool,
) -> None:
    """Background job: do the slow external work (image upload, Groq vision
    classification, reverse geocoding) AFTER the response has been sent, then
    update the stored rows. Keeps the user's report request fast (~1s)."""

    async def _upload():
        return await save_report_image(image_bytes, image_filename) if image_bytes else None

    async def _classify():
        # Only new issues need an accurate type; duplicates inherit the existing one.
        if not is_new:
            return None
        issue_type, _ = await classify_issue(
            description, image_bytes=image_bytes, image_filename=image_filename
        )
        return issue_type

    async def _geocode():
        return await reverse_geocode(lat, lng) if need_address else None

    image_url, refined_type, address = await asyncio.gather(
        _upload(), _classify(), _geocode()
    )

    db = sessions[city]()
    try:
        if image_url:
            report = db.query(Report).filter(Report.id == report_id).first()
            if report:
                report.image_url = image_url

        if is_new:
            issue = db.query(Issue).filter(Issue.id == issue_id).first()
            if issue:
                if refined_type:
                    issue.type = refined_type
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
    background_tasks: BackgroundTasks | None = None,
) -> dict:
    # 1. Determine city and get session
    city = get_city_from_coords(lat, lng)
    db = sessions[city]()

    try:
        # 2. Instant keyword-based type + cached address so we can respond fast.
        #    Groq vision classification, image upload and geocoding all happen in
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
