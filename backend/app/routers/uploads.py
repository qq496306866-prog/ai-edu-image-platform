from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.dependencies import get_current_user, get_db
from app.models import GenerationItem, GenerationJob, User
from app.schemas import ExcelPreviewItem, ExcelUploadResponse
from app.services.excel_parser import parse_generation_excel

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("/excel", response_model=ExcelUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExcelUploadResponse:
    settings = get_settings()
    filename = file.filename or ""
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .xlsx files are supported")

    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File is too large")

    upload_root = Path(settings.upload_dir) / str(current_user.id)
    upload_root.mkdir(parents=True, exist_ok=True)
    saved_path = upload_root / f"{uuid4().hex}.xlsx"
    saved_path.write_bytes(content)

    try:
        parsed_items = parse_generation_excel(saved_path)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not parsed_items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid rows found in Excel")

    job = GenerationJob(
        user_id=current_user.id,
        status="pending",
        total_count=len(parsed_items),
        source_excel_path=str(saved_path),
    )
    db.add(job)
    db.flush()

    for parsed_item in parsed_items:
        db.add(
            GenerationItem(
                job_id=job.id,
                title=parsed_item.title,
                prompt=parsed_item.prompt,
                reference_image_path=parsed_item.reference_image_path,
                status="pending",
            )
        )

    db.commit()
    db.refresh(job)

    return ExcelUploadResponse(
        job_id=job.id,
        total_count=len(parsed_items),
        preview=[
            ExcelPreviewItem(
                row_number=item.row_number,
                title=item.title,
                prompt=item.prompt,
                reference_image_path=item.reference_image_path,
            )
            for item in parsed_items[:10]
        ],
    )
