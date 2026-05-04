"""
Issue orchestration service:
classify → reverse geocode → deduplicate (Haversine) → persist
"""
from sqlalchemy.orm import Session
from app.services.classification import classify_issue
from app.services.geocoding import reverse_geocode
from app.repositories import issue_repo, report_repo
from app.config import settings
import os
import uuid
import aiofiles


async def handle_report(
    db: Session,
    description: str,
    lat: float,
    lng: float,
    user_id: int | None,
    image_bytes: bytes | None,
    image_filename: str | None,
) -> dict:
    # 1. Classify via Groq
    issue_type = await classify_issue(description)

    # 2. Reverse geocode
    address = await reverse_geocode(lat, lng)

    # 3. Save uploaded image locally
    image_url = None
    if image_bytes and image_filename:
        upload_dir = settings.UPLOAD_DIR
        os.makedirs(upload_dir, exist_ok=True)
        ext = os.path.splitext(image_filename)[-1] or ".jpg"
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(upload_dir, filename)
        async with aiofiles.open(filepath, "wb") as f:
            await f.write(image_bytes)
        image_url = f"/uploads/{filename}"

    # 4. Deduplication – Haversine within 10 m
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
        }
