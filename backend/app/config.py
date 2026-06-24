from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


# Known insecure values that must never be used to sign tokens in any
# environment. If SECRET_KEY matches one of these the app refuses to start.
_INSECURE_SECRET_KEYS = {
    "",
    "civic-issue-reporting-secret-key-2024",
    "your-super-secret-jwt-key-change-this-in-production",
}


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./civic.db"
    POSTGRES_URL: str = ""
    # No default: the JWT signing key MUST be provided via environment so it can
    # never be guessed from the source code (see validator below).
    SECRET_KEY: str
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
    # Clerk server-side verification (used to validate the Clerk session token in
    # /api/auth/clerk-sync). CLERK_ISSUER pins which Clerk instance we trust, e.g.
    # https://your-app.clerk.accounts.dev
    CLERK_ISSUER: str = ""

    @field_validator("SECRET_KEY")
    @classmethod
    def _reject_insecure_secret(cls, value: str) -> str:
        if value.strip() in _INSECURE_SECRET_KEYS:
            raise ValueError(
                "SECRET_KEY is missing or set to a known insecure default. "
                "Set a strong, random SECRET_KEY in the environment "
                "(e.g. `python -c \"import secrets; print(secrets.token_urlsafe(64))\"`)."
            )
        return value

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
