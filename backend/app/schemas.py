from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class AdminCreditGrantRequest(BaseModel):
    email: EmailStr
    amount: int = Field(ge=1, le=10000)
    description: str | None = Field(default=None, max_length=500)


class ImageProviderStatusRead(BaseModel):
    provider: str
    image_api_base_url: str
    image_model: str
    has_api_key: bool
    source: str
    is_ready: bool
    missing_settings: list[str] = Field(default_factory=list)
    timeout_seconds: float
    retry_count: int
    mock_delay_seconds: float


class ImageProviderConfigUpdate(BaseModel):
    provider: str = Field(pattern="^(mock|real)$")
    image_api_base_url: str = Field(default="", max_length=1000)
    image_api_key: str | None = Field(default=None, max_length=5000)
    image_model: str = Field(default="", max_length=200)
    timeout_seconds: float = Field(default=60, ge=1, le=300)
    retry_count: int = Field(default=2, ge=0, le=10)
    mock_delay_seconds: float = Field(default=0, ge=0, le=60)


class ImageProviderTestRequest(BaseModel):
    title: str = Field(default="Provider test", min_length=1, max_length=200)
    prompt: str = Field(
        default="Create a simple educational illustration for testing the image provider.",
        min_length=1,
        max_length=2000,
    )


class ImageProviderTestResponse(BaseModel):
    provider: str
    image_path: str
    image_url: str


class UserRead(BaseModel):
    id: int
    email: EmailStr
    role: str
    credit_balance: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ExcelPreviewItem(BaseModel):
    row_number: int
    title: str
    prompt: str
    reference_image_path: str | None = None


class ExcelUploadResponse(BaseModel):
    job_id: int
    total_count: int
    preview: list[ExcelPreviewItem]


class GenerationJobRead(BaseModel):
    id: int
    status: str
    total_count: int
    success_count: int
    failed_count: int
    source_excel_path: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GenerationItemRead(BaseModel):
    id: int
    job_id: int
    title: str
    prompt: str
    reference_image_path: str | None = None
    status: str
    result_image_path: str | None = None
    error_message: str | None = None
    result_image_url: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CreditTransactionRead(BaseModel):
    id: int
    user_id: int
    job_id: int | None = None
    item_id: int | None = None
    amount: int
    type: str
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}
