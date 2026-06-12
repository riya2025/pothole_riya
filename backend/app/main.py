import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routes import auth, issues, users
from app.config import settings
from app.database import create_tables

app = FastAPI(
    title="Civic Issue Reporting API",
    description="Report and track civic issues like potholes, garbage, and streetlights.",
    version="1.0.0",
)

# ── Auto-create tables on startup (SQLite) ────────────────────────────────────
@app.on_event("startup")
def on_startup():
    create_tables()

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://pothole-riya.vercel.app",
        "https://civic-issue-api-612t.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static file serving for uploaded images ────────────────────────────────────
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(issues.router)
app.include_router(users.router)


@app.get("/", tags=["health"])
def health_check():
    mode = "Postgres mode" if settings.POSTGRES_URL else "SQLite mode"
    return {"status": "ok", "message": f"Civic Issue Reporting API is running ({mode})"}


@app.get("/api/health/ai", tags=["health"])
async def ai_health_check():
    from app.services.classification import groq_status
    return await groq_status()
