from sqlalchemy.orm import Session
from app.models.issue import Issue
from typing import Optional, List
import math


# ── Haversine distance (metres) ───────────────────────────────────────────────
def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_all_issues(db: Session) -> List[Issue]:
    return db.query(Issue).order_by(Issue.created_at.desc()).all()


def find_nearby_issue(db: Session, lat: float, lng: float, radius_meters: float = 10.0) -> Optional[Issue]:
    """
    Find the nearest existing issue within `radius_meters` using Haversine formula.
    (Replaces the PostGIS ST_DWithin query for SQLite compatibility.)
    """
    # Rough bounding-box pre-filter to avoid full-table Haversine on large datasets
    deg_offset = radius_meters / 111_000  # ~1 degree latitude = 111 km
    candidates = (
        db.query(Issue)
        .filter(
            Issue.latitude.between(lat - deg_offset, lat + deg_offset),
            Issue.longitude.between(lng - deg_offset, lng + deg_offset),
        )
        .all()
    )
    best: Optional[Issue] = None
    best_dist = float("inf")
    for issue in candidates:
        if issue.latitude is None or issue.longitude is None:
            continue
        dist = _haversine_m(lat, lng, issue.latitude, issue.longitude)
        if dist <= radius_meters and dist < best_dist:
            best_dist = dist
            best = issue
    return best


def create_issue(
    db: Session,
    issue_type: str,
    lat: float,
    lng: float,
    address: Optional[str] = None,
) -> Issue:
    issue = Issue(
        type=issue_type,
        status="active",
        latitude=lat,
        longitude=lng,
        address=address,
        report_count=1,
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue


def increment_report_count(db: Session, issue: Issue) -> Issue:
    issue.report_count += 1
    db.commit()
    db.refresh(issue)
    return issue


def get_issue_lat_lng(issue: Issue):
    return issue.latitude, issue.longitude
