from time import time

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.dependencies import get_current_admin_user, get_current_user, get_db, sync_configured_admin_role
from app.models import CreditTransaction, User
from app.providers.image_generation import get_image_generation_provider
from app.schemas import (
    AdminCreditGrantRequest,
    CreditTransactionRead,
    ImageProviderStatusRead,
    ImageProviderTestRequest,
    ImageProviderTestResponse,
    Token,
    UserCreate,
    UserLogin,
    UserRead,
)
from app.services.credits import create_initial_credit, ensure_user_credit, grant_user_credits
from app.services.files import result_image_url

router = APIRouter(tags=["auth"])


def _user_read(user: User, credit_balance: int) -> UserRead:
    return UserRead.model_validate(user).model_copy(update={"credit_balance": credit_balance})


def _image_provider_missing_settings() -> list[str]:
    settings = get_settings()
    missing_settings: list[str] = []
    if settings.image_provider == "real":
        if not settings.image_api_base_url:
            missing_settings.append("IMAGE_API_BASE_URL")
        if not settings.image_api_key:
            missing_settings.append("IMAGE_API_KEY")
        if not settings.image_model:
            missing_settings.append("IMAGE_MODEL")
    elif settings.image_provider != "mock":
        missing_settings.append("IMAGE_PROVIDER")

    return missing_settings


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


@router.get("/api/admin/image-provider", response_model=ImageProviderStatusRead)
def image_provider_status(_current_admin: User = Depends(get_current_admin_user)) -> ImageProviderStatusRead:
    settings = get_settings()
    missing_settings = _image_provider_missing_settings()

    return ImageProviderStatusRead(
        provider=settings.image_provider,
        image_api_base_url=settings.image_api_base_url,
        image_model=settings.image_model,
        has_api_key=bool(settings.image_api_key),
        is_ready=len(missing_settings) == 0,
        missing_settings=missing_settings,
        timeout_seconds=settings.image_api_timeout_seconds,
        retry_count=settings.image_api_retry_count,
        mock_delay_seconds=settings.mock_image_delay_seconds,
    )


@router.post("/api/admin/image-provider/test", response_model=ImageProviderTestResponse)
def test_image_provider(
    payload: ImageProviderTestRequest,
    _current_admin: User = Depends(get_current_admin_user),
) -> ImageProviderTestResponse:
    settings = get_settings()
    missing_settings = _image_provider_missing_settings()
    if missing_settings:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Image provider is not ready. Missing settings: {', '.join(missing_settings)}",
        )

    provider = get_image_generation_provider()
    item_id = int(time() * 1000)
    try:
        image_path = provider.generate(
            job_id=0,
            item_id=item_id,
            title=payload.title,
            prompt=payload.prompt,
            reference_image_path=None,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Image provider test failed: {exc}") from exc

    image_url = result_image_url(image_path)
    if image_url is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Generated image URL is unavailable")

    return ImageProviderTestResponse(provider=settings.image_provider, image_path=image_path, image_url=image_url)


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
