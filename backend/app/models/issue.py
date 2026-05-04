from sqlalchemy import Column, Integer, String, Float, DateTime, func
from app.database import Base


class Issue(Base):
    __tablename__ = "issues"

    id           = Column(Integer, primary_key=True, index=True)
    type         = Column(String(50),  nullable=False, default="other")
    status       = Column(String(30),  nullable=False, default="active")
    latitude     = Column(Float,       nullable=True)
    longitude    = Column(Float,       nullable=True)
    address      = Column(String,      nullable=True)
    report_count = Column(Integer,     nullable=False, default=1)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
