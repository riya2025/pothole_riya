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
        # 2. Classify via Groq vision (photo) or text, then keyword fallback
        issue_type, classification_source = await classify_issue(
            description,
            image_bytes=image_bytes,
            image_filename=image_filename,
        )

        # 3. Reverse geocode
        address = await reverse_geocode(lat, lng)

        # 4. Save uploaded image (Cloudinary in prod, local disk in dev)
        image_url = await save_report_image(image_bytes, image_filename) if image_bytes else None

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
            }
    finally:
        db.close()
