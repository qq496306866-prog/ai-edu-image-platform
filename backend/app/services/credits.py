from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CreditTransaction, GenerationJob, UserCredit

INITIAL_CREDIT_BALANCE = 20
IMAGE_CREDIT_COST = 1


def ensure_user_credit(db: Session, user_id: int) -> UserCredit:
    credit = db.get(UserCredit, user_id)
    if credit is not None:
        return credit

    credit = UserCredit(user_id=user_id, balance=INITIAL_CREDIT_BALANCE)
    db.add(credit)
    db.add(
        CreditTransaction(
            user_id=user_id,
            amount=INITIAL_CREDIT_BALANCE,
            type="grant",
            description="Initial MVP credits",
        )
    )
    db.flush()
    return credit


def create_initial_credit(db: Session, user_id: int) -> UserCredit:
    return ensure_user_credit(db, user_id)


def pending_item_count(db: Session, job_id: int) -> int:
    from app.models import GenerationItem

    return len(
        list(
            db.scalars(
                select(GenerationItem.id)
                .where(GenerationItem.job_id == job_id)
                .where(GenerationItem.status == "pending")
            ).all()
        )
    )


def spend_credits_for_job(db: Session, job: GenerationJob) -> int:
    required_credits = pending_item_count(db, job.id) * IMAGE_CREDIT_COST
    credit = ensure_user_credit(db, job.user_id)
    if credit.balance < required_credits:
        return 0

    credit.balance -= required_credits
    db.add(
        CreditTransaction(
            user_id=job.user_id,
            job_id=job.id,
            amount=-required_credits,
            type="debit",
            description=f"Start generation job #{job.id}",
        )
    )
    return required_credits


def spend_credit_for_item(db: Session, job: GenerationJob, item_id: int) -> bool:
    credit = ensure_user_credit(db, job.user_id)
    if credit.balance < IMAGE_CREDIT_COST:
        return False

    credit.balance -= IMAGE_CREDIT_COST
    db.add(
        CreditTransaction(
            user_id=job.user_id,
            job_id=job.id,
            item_id=item_id,
            amount=-IMAGE_CREDIT_COST,
            type="debit",
            description=f"Retry generation item #{item_id}",
        )
    )
    return True


def refund_item_credit(db: Session, job: GenerationJob, item_id: int, description: str | None = None) -> None:
    credit = ensure_user_credit(db, job.user_id)
    credit.balance += IMAGE_CREDIT_COST
    db.add(
        CreditTransaction(
            user_id=job.user_id,
            job_id=job.id,
            item_id=item_id,
            amount=IMAGE_CREDIT_COST,
            type="refund",
            description=description or f"Refund failed item #{item_id}",
        )
    )
