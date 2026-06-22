import asyncio
from fastapi import BackgroundTasks
from sqlalchemy.orm import Session
from app.services.classification import classify_issue
from app.services.geocoding import reverse_geocode, get_cached_address
from app.repositories import issue_repo, report_repo
from app.database import sessions
from app.models.issue import Issue
from app.services.storage import save_report_image


async def resolve_issue_address(city: str, issue_id: int, lat: float, lng: float) -> None:
    """Background job: reverse-geocode and fill in the issue's address after the
    response has already been sent, so the user never waits on geocoding."""
    address = await reverse_geocode(lat, lng)
    if not address:
        return
    db = sessions[city]()
    try:
        issue = db.query(Issue).filter(Issue.id == issue_id).first()
        if issue and not issue.address:
            issue.address = address
            db.commit()
    finally:
        db.close()


def get_city_from_coords(lat: float, lng: float) -> str:
    # Bangalore bounds approximately
    if 12.5 <= lat <= 13.5 and 77.0 <= lng <= 78.0:
        return "bangalore"
    # Vijayawada bounds approximately
    if 16.3 <= lat <= 16.7 and 80.4 <= lng <= 80.9:
        return "vijayawada"
    # Default to Hyderabad
    return "hyderabad"


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
        # 2-3. Classify (Groq) and upload the image concurrently. Both are needed
        # immediately in the response (issue type + photo URL), so we wait on them.
        # Geocoding (the slowest call) is deferred to a background task below.
        (issue_type, classification_source), image_url = await asyncio.gather(
            classify_issue(
                description,
                image_bytes=image_bytes,
                image_filename=image_filename,
            ),
            save_report_image(image_bytes, image_filename),
        )

        # 4. Deduplication in the selected city database
        existing = issue_repo.find_nearby_issue(db, lat, lng, radius_meters=10.0)

        if existing:
            issue_repo.increment_report_count(db, existing)
            report_repo.create_report(
                db,
                issue_id=existing.id,
                user_id=user_id,
                image_url=image_url,
                description=description,
                latitude=lat,
                longitude=lng,
            )
            return {
                "issue_id": existing.id,
                "status": "attached",
                "address": existing.address,
                "type": existing.type,
                "city": city,
                "latitude": lat,
                "longitude": lng,
                "classification_source": classification_source,
                "image_url": image_url,
            }

        # 5. New issue. Use a cached address instantly if we have one; otherwise
        #    create it now and resolve the address in the background (no user wait).
        address = get_cached_address(lat, lng)
        new_issue = issue_repo.create_issue(db, issue_type, lat, lng, address)
        report_repo.create_report(
            db,
            issue_id=new_issue.id,
            user_id=user_id,
            image_url=image_url,
            description=description,
            latitude=lat,
            longitude=lng,
        )

        if address is None:
            if background_tasks is not None:
                background_tasks.add_task(resolve_issue_address, city, new_issue.id, lat, lng)
            else:
                # No background-task context (e.g. direct service call): resolve inline.
                address = await reverse_geocode(lat, lng)
                if address:
                    new_issue.address = address
                    db.commit()

        return {
            "issue_id": new_issue.id,
            "status": "created",
            "address": address,
            "type": issue_type,
            "city": city,
            "latitude": lat,
            "longitude": lng,
            "classification_source": classification_source,
            "image_url": image_url,
        }
    finally:
        db.close()
