from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.schemas.user import UserCreate, UserOut, Token, ClerkSyncRequest
from app.repositories.user_repo import get_user_by_email, create_user, verify_password
from app.services.auth_service import create_access_token
from app.services.clerk_auth import verify_clerk_token, ClerkAuthError
import secrets

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if get_user_by_email(db, payload.email):
        raise HTTPException(400, detail="Email already registered")
    return create_user(db, payload.name, payload.email, payload.password)


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/clerk-sync", response_model=Token)
def clerk_sync(
    payload: ClerkSyncRequest,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    """Find or create a user from a verified Clerk session and return a backend JWT.

    The caller MUST send the Clerk session token as `Authorization: Bearer <token>`.
    We verify it server-side and require the verified Clerk user id (`sub`) to match
    the claimed `clerk_id`, so a JWT can't be minted for an arbitrary account.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Clerk session token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    clerk_token = authorization.split(" ", 1)[1].strip()

    try:
        claims = verify_clerk_token(clerk_token)
    except ClerkAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Clerk session verification failed: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    verified_clerk_id = claims.get("sub")
    if not verified_clerk_id or verified_clerk_id != payload.clerk_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clerk session does not match the requested account",
        )

    user = get_user_by_email(db, payload.email)
    if not user:
        random_password = secrets.token_urlsafe(32)
        user = create_user(db, payload.name, payload.email, random_password)
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}
