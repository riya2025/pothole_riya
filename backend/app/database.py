from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
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

# Logical "city" databases. On Postgres these all live in ONE physical database,
# so they share a single engine/pool. On local SQLite they're separate files.
CITY_KEYS = ["users", "hyderabad", "bangalore", "vijayawada"]

Base = declarative_base()


if raw_postgres_url:
    # All cities point at the SAME Postgres DB, so use ONE shared engine + pool.
    # Previously each city had its own engine (4 pools × up to 15 conns ≈ 60),
    # which exhausted Supabase's connection limit under load and caused 500s.
    # A single bounded pool keeps us well under the limit; pool_timeout makes
    # extra requests wait briefly for a free connection instead of erroring.
    engine = create_engine(
        raw_postgres_url,
        connect_args={"sslmode": "require"},
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=10,
        pool_recycle=300,
        pool_timeout=30,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    engines = {key: engine for key in CITY_KEYS}
    sessions = {key: SessionLocal for key in CITY_KEYS}
else:
    # Local dev: a separate SQLite file per city.
    DATABASE_URLS = {
        "users": "sqlite:///./users.db",
        "hyderabad": "sqlite:///./hyderabad.db",
        "bangalore": "sqlite:///./bangalore.db",
        "vijayawada": "sqlite:///./vijayawada.db",
    }
    engines = {
        key: create_engine(
            url,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
        )
        for key, url in DATABASE_URLS.items()
    }
    sessions = {
        key: sessionmaker(autocommit=False, autoflush=False, bind=eng)
        for key, eng in engines.items()
    }


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


def get_db_vijayawada():
    db = sessions["vijayawada"]()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all tables in every distinct database."""
    from app.models import User, Issue, Report  # noqa: F401

    seen_engines = set()
    for engine in engines.values():
        if id(engine) in seen_engines:
            continue
        seen_engines.add(id(engine))
        Base.metadata.create_all(bind=engine)
