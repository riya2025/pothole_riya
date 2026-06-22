import asyncio
from sqlalchemy.orm import Session
from app.services.classification import classify_issue
from app.services.geocoding import reverse_geocode
from app.repositories import issue_repo, report_repo
from app.database import sessions
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


async def handle_report(
    description: str,
    lat: float,
    lng: float,
    user_id: int | None,
    image_bytes: bytes | None,
    image_filename: str | None,
) -> dict:
    # 1. Determine city and get session
    city = get_city_from_coords(lat, lng)
    db = sessions[city]()

    try:
        # 2-4. Classify (Groq), reverse geocode, and upload the image concurrently.
        # These are independent, slow, external calls — running them in parallel
        # instead of sequentially cuts report latency to ~the slowest single call.
        (issue_type, classification_source), address, image_url = await asyncio.gather(
            classify_issue(
                description,
                image_bytes=image_bytes,
                image_filename=image_filename,
            ),
            reverse_geocode(lat, lng),
            save_report_image(image_bytes, image_filename),
        )

        # 5. Deduplication in the selected city database
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
                "address": address,
                "type": existing.type,
                "city": city,
                "latitude": lat,
                "longitude": lng,
                "classification_source": classification_source,
                "image_url": image_url,
            }
        else:
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
