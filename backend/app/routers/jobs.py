from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models import GenerationItem, GenerationJob, User
from app.schemas import GenerationItemRead, GenerationJobRead
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


@router.get("/{job_id}/items", response_model=list[GenerationItemRead])
def list_job_items(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GenerationItem]:
    job = db.get(GenerationJob, job_id)
    if job is None or job.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    statement = (
        select(GenerationItem)
        .where(GenerationItem.job_id == job.id)
        .order_by(GenerationItem.id.asc())
    )
    return list(db.scalars(statement).all())


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
