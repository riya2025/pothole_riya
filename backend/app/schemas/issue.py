from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class IssueOut(BaseModel):
    id: int
    type: str
    status: str
    address: Optional[str] = None
    report_count: int
    lat: Optional[float] = None
    lng: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class IssueReportResponse(BaseModel):
    issue_id: int
    status: str   # "created" | "attached"
    address: Optional[str] = None
    type: str
