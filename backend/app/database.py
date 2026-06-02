from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from app.config import settings

# Database configuration
raw_postgres_url = settings.POSTGRES_URL

if raw_postgres_url:
    # Fix postgres:// to postgresql:// for SQLAlchemy 2.0+
    if raw_postgres_url.startswith("postgres://"):
        raw_postgres_url = raw_postgres_url.replace("postgres://", "postgresql://", 1)
    
    # Ensure sslmode=require is present
    if "sslmode=" not in raw_postgres_url:
        separator = "&" if "?" in raw_postgres_url else "?"
        raw_postgres_url = f"{raw_postgres_url}{separator}sslmode=require"

DATABASE_URLS = {
    "users": raw_postgres_url or "sqlite:///./users.db",
    "hyderabad": raw_postgres_url or "sqlite:///./hyderabad.db",
    "bangalore": raw_postgres_url or "sqlite:///./bangalore.db",
}

# Connection arguments
CONNECT_ARGS = {}
if raw_postgres_url:
    CONNECT_ARGS = {"sslmode": "require"}
else:
    # SQLite specific check_same_thread
    CONNECT_ARGS = {"check_same_thread": False}

engines = {
    k: create_engine(
        v, 
        connect_args=CONNECT_ARGS,
        pool_pre_ping=True
    ) for k, v in DATABASE_URLS.items()
}
sessions = {k: sessionmaker(autocommit=False, autoflush=False, bind=v) for k, v in engines.items()}

Base = declarative_base()


def get_db():
    """Default DB session (users)"""
    db = sessions["users"]()
    try:
        yield db
    finally:
        db.close()


def get_db_hyderabad():
    db = sessions["hyderabad"]()
    try:
        yield db
    finally:
        db.close()


def get_db_bangalore():
    db = sessions["bangalore"]()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all tables in all databases."""
    from app.models import User, Issue, Report  # noqa: F401
    for engine in engines.values():
        Base.metadata.create_all(bind=engine)
