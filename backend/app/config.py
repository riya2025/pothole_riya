from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./civic.db"
    POSTGRES_URL: str = ""
    SECRET_KEY: str = "civic-issue-reporting-secret-key-2024"
    GROQ_API_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days — fewer slow re-syncs on return visits
    UPLOAD_DIR: str = "uploads"
    # Cloudinary (recommended for Render/production — local uploads are wiped on redeploy)
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Auto-email civic complaints (with the original photo attached) to GHMC.
    # Works with any SMTP provider — e.g. Gmail (app password) or SendGrid.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""          # defaults to SMTP_USER if blank
    GHMC_EMAIL: str = ""         # GHMC grievance inbox (recipient)

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
