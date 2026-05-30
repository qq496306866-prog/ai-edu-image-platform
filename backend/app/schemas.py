from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: int
    email: EmailStr
    role: str
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
