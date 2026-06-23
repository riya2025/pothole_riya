from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./civic.db"
    POSTGRES_URL: str = ""
    SECRET_KEY: str = "civic-issue-reporting-secret-key-2024"
    GROQ_API_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days — fewer slow re-syncs on return visits
    # bcrypt work factor. 12 is very CPU-heavy on small instances; 10 is the
    # OWASP-recommended minimum and ~4x cheaper, which matters under login bursts.
    BCRYPT_ROUNDS: int = 10
    UPLOAD_DIR: str = "uploads"
    # Cloudinary (recommended for Render/production — local uploads are wiped on redeploy)
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
