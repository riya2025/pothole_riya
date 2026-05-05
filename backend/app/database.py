from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# SQLite configuration
CONNECT_ARGS = {"check_same_thread": False}

DATABASE_URLS = {
    "users": "sqlite:///./users.db",
    "hyderabad": "sqlite:///./hyderabad.db",
    "bangalore": "sqlite:///./bangalore.db",
}

engines = {k: create_engine(v, connect_args=CONNECT_ARGS) for k, v in DATABASE_URLS.items()}
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
