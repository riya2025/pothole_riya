from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class IssueOut(BaseModel):
    id: int
    type: str
    status: str
    address: Optional[str] = None
    report_count: int
    lat: Optional[float] = None
    lng: Optional[float] = None
    city: str
    created_at: datetime

    class Config:
        from_attributes = True


class IssueReportResponse(BaseModel):
    issue_id: int
    status: str   # "created" | "attached"
    address: Optional[str] = None
    type: str


class ReportOut(BaseModel):
    id: int
    description: Optional[str] = None
    image_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class IssueDetailOut(BaseModel):
    id: int
    type: str
    status: str
    address: Optional[str] = None
    report_count: int
    lat: Optional[float] = None
    lng: Optional[float] = None
    city: str
    created_at: datetime
    reports: List[ReportOut]
