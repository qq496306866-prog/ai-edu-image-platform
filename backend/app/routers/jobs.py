from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models import GenerationItem, GenerationJob, User
from app.schemas import GenerationItemRead, GenerationJobRead
from app.services.files import result_image_url, safe_filename
from app.worker import process_generation_job

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", response_model=list[GenerationJobRead])
def list_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GenerationJob]:
    statement = (
        select(GenerationJob)
        .where(GenerationJob.user_id == current_user.id)
        .order_by(GenerationJob.created_at.desc())
    )
    return list(db.scalars(statement).all())


@router.get("/{job_id}", response_model=GenerationJobRead)
def get_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GenerationJob:
    job = db.get(GenerationJob, job_id)
    if job is None or job.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


def _item_to_read(item: GenerationItem) -> GenerationItemRead:
    return GenerationItemRead.model_validate(item).model_copy(
        update={"result_image_url": result_image_url(item.result_image_path)}
    )


@router.get("/{job_id}/items", response_model=list[GenerationItemRead])
def list_job_items(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GenerationItemRead]:
    job = db.get(GenerationJob, job_id)
    if job is None or job.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    statement = (
        select(GenerationItem)
        .where(GenerationItem.job_id == job.id)
        .order_by(GenerationItem.id.asc())
    )
    return [_item_to_read(item) for item in db.scalars(statement).all()]


@router.post("/{job_id}/start", response_model=GenerationJobRead)
def start_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GenerationJob:
    job = db.get(GenerationJob, job_id)
    if job is None or job.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status not in {"pending", "failed"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Job has already started")

    job.status = "running"
    db.commit()
    db.refresh(job)
    process_generation_job.delay(job.id)
    return job


@router.get("/{job_id}/download-zip")
def download_job_zip(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    job = db.get(GenerationJob, job_id)
    if job is None or job.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    statement = (
        select(GenerationItem)
        .where(GenerationItem.job_id == job.id)
        .where(GenerationItem.result_image_path.is_not(None))
        .order_by(GenerationItem.id.asc())
    )
    items = list(db.scalars(statement).all())
    if not items:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No generated images found")

    archive = BytesIO()
    added_count = 0
    with ZipFile(archive, "w", ZIP_DEFLATED) as zip_file:
        for item in items:
            if not item.result_image_path:
                continue
            image_path = Path(item.result_image_path)
            if image_path.exists():
                zip_file.write(image_path, arcname=f"{item.id}-{safe_filename(item.title)}.jpg")
                added_count += 1

    if added_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No generated image files found")

    archive.seek(0)
    filename = safe_filename(f"job-{job.id}-images.zip")
    return StreamingResponse(
        archive,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
