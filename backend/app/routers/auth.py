from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.dependencies import get_current_admin_user, get_current_user, get_db, sync_configured_admin_role
from app.models import CreditTransaction, User
from app.schemas import AdminCreditGrantRequest, CreditTransactionRead, Token, UserCreate, UserLogin, UserRead
from app.services.credits import create_initial_credit, ensure_user_credit, grant_user_credits

router = APIRouter(tags=["auth"])


def _user_read(user: User, credit_balance: int) -> UserRead:
    return UserRead.model_validate(user).model_copy(update={"credit_balance": credit_balance})


@router.post("/api/auth/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> UserRead:
    existing_user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    user = User(email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()
    sync_configured_admin_role(user, db)
    credit = create_initial_credit(db, user.id)
    db.commit()
    db.refresh(user)
    return _user_read(user, credit.balance)


@router.post("/api/auth/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> Token:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    return Token(access_token=create_access_token(str(user.id)))


@router.get("/api/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserRead:
    sync_configured_admin_role(current_user, db)
    credit = ensure_user_credit(db, current_user.id)
    db.commit()
    db.refresh(current_user)
    return _user_read(current_user, credit.balance)


@router.post("/api/admin/credits/grant", response_model=UserRead)
def grant_credits(
    payload: AdminCreditGrantRequest,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> UserRead:
    target_user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    description = payload.description or f"Admin grant by {current_admin.email}"
    credit = grant_user_credits(db, target_user, payload.amount, description)
    db.commit()
    db.refresh(target_user)
    return _user_read(target_user, credit.balance)


@router.get("/api/credits/transactions", response_model=list[CreditTransactionRead])
def list_credit_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CreditTransaction]:
    statement = (
        select(CreditTransaction)
        .where(CreditTransaction.user_id == current_user.id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(50)
    )
    return list(db.scalars(statement).all())
