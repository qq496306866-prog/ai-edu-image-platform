from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models import User

bearer_scheme = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    subject = decode_access_token(credentials.credentials)
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    user = db.get(User, int(subject)) if subject.isdigit() else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    return user


def configured_admin_emails() -> set[str]:
    settings = get_settings()
    return {
        email.strip().lower()
        for email in settings.admin_emails.split(",")
        if email.strip()
    }


def sync_configured_admin_role(user: User, db: Session) -> None:
    if user.email.lower() in configured_admin_emails() and user.role != "admin":
        user.role = "admin"
        db.commit()
        db.refresh(user)


def get_current_admin_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    sync_configured_admin_role(current_user, db)
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
