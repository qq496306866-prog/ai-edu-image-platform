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
