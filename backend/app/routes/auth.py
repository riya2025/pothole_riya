from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.user import UserCreate, UserOut, Token, ClerkSyncRequest
from app.repositories.user_repo import get_user_by_email, create_user, verify_password
from app.services.auth_service import create_access_token
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
def clerk_sync(payload: ClerkSyncRequest, db: Session = Depends(get_db)):
    """Find or create a user from Clerk OAuth and return a backend JWT."""
    user = get_user_by_email(db, payload.email)
    if not user:
        random_password = secrets.token_urlsafe(32)
        user = create_user(db, payload.name, payload.email, random_password)
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}
