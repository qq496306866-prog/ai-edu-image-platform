from celery import Celery
from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import GenerationItem, GenerationJob
from app.providers.image_generation import get_image_generation_provider
from app.services.credits import refund_item_credit

settings = get_settings()

celery_app = Celery(
    "ai_edu_image_platform",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)


@celery_app.task(name="app.worker.healthcheck")
def healthcheck() -> str:
    return "ok"


@celery_app.task(name="app.worker.process_generation_job")
def process_generation_job(job_id: int) -> dict[str, int]:
    db = SessionLocal()
    provider = get_image_generation_provider()

    try:
        job = db.get(GenerationJob, job_id)
        if job is None:
            return {"job_id": job_id, "processed": 0}

        job.status = "running"
        db.commit()

        items = list(
            db.scalars(
                select(GenerationItem)
                .where(GenerationItem.job_id == job.id)
                .where(GenerationItem.status == "pending")
                .order_by(GenerationItem.id.asc())
            ).all()
        )

        success_count = 0
        failed_count = 0
        for item in items:
            db.refresh(job)
            if job.status == "cancelled":
                break

            item.status = "generating"
            item.error_message = None
            db.commit()

            try:
                result_image_path = provider.generate(
                    job_id=job.id,
                    item_id=item.id,
                    title=item.title,
                    prompt=item.prompt,
                    reference_image_path=item.reference_image_path,
                )
                db.refresh(job)
                if job.status == "cancelled":
                    item.status = "completed"
                    item.result_image_path = result_image_path
                else:
                    item.status = "completed"
                    item.result_image_path = result_image_path
                    success_count += 1
            except Exception as exc:  # noqa: BLE001
                db.refresh(job)
                if job.status == "cancelled":
                    item.status = "cancelled"
                    item.error_message = None
                    refund_item_credit(db, job, item.id, description=f"Refund cancelled item #{item.id}")
                    db.commit()
                    break

                item.status = "failed"
                item.error_message = str(exc)
                refund_item_credit(db, job, item.id)
                failed_count += 1

            db.commit()

        items = list(db.scalars(select(GenerationItem).where(GenerationItem.job_id == job.id)).all())
        job.success_count = sum(1 for item in items if item.status == "completed")
        job.failed_count = sum(1 for item in items if item.status == "failed")
        if job.status != "cancelled":
            job.status = "completed" if job.failed_count == 0 else "failed"
        db.commit()
        return {"job_id": job.id, "processed": len(items)}
    finally:
        db.close()


@celery_app.task(name="app.worker.process_generation_item")
def process_generation_item(job_id: int, item_id: int) -> dict[str, int]:
    db = SessionLocal()
    provider = get_image_generation_provider()

    try:
        job = db.get(GenerationJob, job_id)
        item = db.get(GenerationItem, item_id)
        if job is None or item is None or item.job_id != job.id:
            return {"job_id": job_id, "item_id": item_id, "processed": 0}
        if item.status != "pending":
            return {"job_id": job.id, "item_id": item.id, "processed": 0}

        job.status = "running"
        item.status = "generating"
        item.error_message = None
        db.commit()

        try:
            result_image_path = provider.generate(
                job_id=job.id,
                item_id=item.id,
                title=item.title,
                prompt=item.prompt,
                reference_image_path=item.reference_image_path,
            )
            item.status = "completed"
            item.result_image_path = result_image_path
        except Exception as exc:  # noqa: BLE001
            item.status = "failed"
            item.error_message = str(exc)
            refund_item_credit(db, job, item.id)

        items = list(db.scalars(select(GenerationItem).where(GenerationItem.job_id == job.id)).all())
        job.success_count = sum(1 for current_item in items if current_item.status == "completed")
        job.failed_count = sum(1 for current_item in items if current_item.status == "failed")
        if any(current_item.status in {"pending", "generating"} for current_item in items):
            job.status = "running"
        elif job.failed_count > 0:
            job.status = "failed"
        elif job.success_count == job.total_count:
            job.status = "completed"
        elif any(current_item.status == "cancelled" for current_item in items):
            job.status = "cancelled"
        else:
            job.status = "completed"

        db.commit()
        return {"job_id": job.id, "item_id": item.id, "processed": 1}
    finally:
        db.close()
