from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models import GenerationItem, GenerationJob, User
from app.schemas import GenerationItemRead, GenerationJobRead
from app.services.credits import pending_item_count, refund_item_credit, spend_credits_for_job
from app.services.files import result_image_url, safe_filename
from app.worker import process_generation_job

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _update_job_counts(db: Session, job: GenerationJob) -> None:
    items = list(db.scalars(select(GenerationItem).where(GenerationItem.job_id == job.id)).all())
    job.success_count = sum(1 for item in items if item.status == "completed")
    job.failed_count = sum(1 for item in items if item.status == "failed")


@router.get("", response_model=list[GenerationJobRead])
def list_jobs(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GenerationJob]:
    allowed_statuses = {"pending", "running", "completed", "failed", "cancelled"}
    if status_filter is not None and status_filter not in allowed_statuses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job status")

    statement = (
        select(GenerationJob)
        .where(GenerationJob.user_id == current_user.id)
    )
    if status_filter is not None:
        statement = statement.where(GenerationJob.status == status_filter)
    statement = statement.order_by(GenerationJob.created_at.desc()).limit(limit).offset(offset)

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

    required_credits = pending_item_count(db, job.id)
    if required_credits <= 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No pending items to generate")

    spent_credits = spend_credits_for_job(db, job)
    if spent_credits != required_credits:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Insufficient credits")

    job.status = "running"
    db.commit()
    db.refresh(job)
    process_generation_job.delay(job.id)
    return job


@router.post("/{job_id}/cancel", response_model=GenerationJobRead)
def cancel_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GenerationJob:
    job = db.get(GenerationJob, job_id)
    if job is None or job.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status not in {"pending", "running"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Job cannot be cancelled")

    should_refund = job.status == "running"
    pending_items = list(
        db.scalars(
            select(GenerationItem)
            .where(GenerationItem.job_id == job.id)
            .where(GenerationItem.status == "pending")
            .order_by(GenerationItem.id.asc())
        ).all()
    )

    for item in pending_items:
        item.status = "cancelled"
        item.error_message = None
        if should_refund:
            refund_item_credit(db, job, item.id, description=f"Refund cancelled item #{item.id}")

    job.status = "cancelled"
    _update_job_counts(db, job)
    db.commit()
    db.refresh(job)
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
