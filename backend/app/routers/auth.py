from time import time

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.dependencies import get_current_admin_user, get_current_user, get_db, sync_configured_admin_role
from app.models import CreditTransaction, User
from app.providers.image_generation import (
    ImageProviderConfig,
    get_effective_image_provider_config,
    get_image_generation_provider,
    upsert_image_provider_config,
)
from app.schemas import (
    AdminCreditGrantRequest,
    CreditTransactionRead,
    ImageProviderConfigUpdate,
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


def _image_provider_missing_settings(config: ImageProviderConfig) -> list[str]:
    missing_settings: list[str] = []
    if config.image_provider == "real":
        if not config.image_api_base_url:
            missing_settings.append("IMAGE_API_BASE_URL")
        if not config.image_api_key:
            missing_settings.append("IMAGE_API_KEY")
        if not config.image_model:
            missing_settings.append("IMAGE_MODEL")
    elif config.image_provider != "mock":
        missing_settings.append("IMAGE_PROVIDER")

    return missing_settings


def _image_provider_status_read(config: ImageProviderConfig) -> ImageProviderStatusRead:
    missing_settings = _image_provider_missing_settings(config)
    return ImageProviderStatusRead(
        provider=config.image_provider,
        image_api_base_url=config.image_api_base_url,
        image_model=config.image_model,
        has_api_key=bool(config.image_api_key),
        source=config.source,
        is_ready=len(missing_settings) == 0,
        missing_settings=missing_settings,
        timeout_seconds=config.image_api_timeout_seconds,
        retry_count=config.image_api_retry_count,
        mock_delay_seconds=config.mock_image_delay_seconds,
    )


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
def image_provider_status(
    _current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> ImageProviderStatusRead:
    return _image_provider_status_read(get_effective_image_provider_config(db))


@router.put("/api/admin/image-provider", response_model=ImageProviderStatusRead)
def update_image_provider_config(
    payload: ImageProviderConfigUpdate,
    _current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> ImageProviderStatusRead:
    config = upsert_image_provider_config(
        db,
        image_provider=payload.provider,
        image_api_base_url=payload.image_api_base_url.strip(),
        image_api_key=payload.image_api_key.strip() if payload.image_api_key is not None else None,
        image_model=payload.image_model.strip(),
        image_api_timeout_seconds=payload.timeout_seconds,
        image_api_retry_count=payload.retry_count,
        mock_image_delay_seconds=payload.mock_delay_seconds,
    )
    db.commit()
    return _image_provider_status_read(config)


@router.post("/api/admin/image-provider/test", response_model=ImageProviderTestResponse)
def test_image_provider(
    payload: ImageProviderTestRequest,
    _current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> ImageProviderTestResponse:
    config = get_effective_image_provider_config(db)
    missing_settings = _image_provider_missing_settings(config)
    if missing_settings:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Image provider is not ready. Missing settings: {', '.join(missing_settings)}",
        )

    provider = get_image_generation_provider(config)
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

    return ImageProviderTestResponse(provider=config.image_provider, image_path=image_path, image_url=image_url)


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
