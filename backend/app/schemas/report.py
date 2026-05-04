from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ReportOut(BaseModel):
    id: int
    issue_id: int
    user_id: Optional[int] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True
