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
            item.status = "generating"
            item.error_message = None
            db.commit()

            try:
                item.result_image_path = provider.generate(
                    job_id=job.id,
                    item_id=item.id,
                    title=item.title,
                    prompt=item.prompt,
                    reference_image_path=item.reference_image_path,
                )
                item.status = "completed"
                success_count += 1
            except Exception as exc:  # noqa: BLE001
                item.status = "failed"
                item.error_message = str(exc)
                refund_item_credit(db, job, item.id)
                failed_count += 1

            db.commit()

        job.success_count = success_count
        job.failed_count = failed_count
        job.status = "completed" if failed_count == 0 else "failed"
        db.commit()
        return {"job_id": job.id, "processed": len(items)}
    finally:
        db.close()
