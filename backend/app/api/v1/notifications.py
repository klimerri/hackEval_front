from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationList, NotificationOut

router = APIRouter()


@router.get("", response_model=NotificationList)
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NotificationList:
    rows = (
        await db.execute(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
    ).scalars().all()
    unread = (
        await db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == user.id, Notification.read.is_(False)
            )
        )
    ).scalar() or 0
    return NotificationList(unread=unread, items=[NotificationOut.model_validate(r) for r in rows])


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NotificationOut:
    n = (
        await db.execute(
            select(Notification).where(
                Notification.id == notification_id, Notification.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="notification not found")
    n.read = True
    await db.commit()
    await db.refresh(n)
    return NotificationOut.model_validate(n)


@router.post("/read-all", status_code=204)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read.is_(False))
        .values(read=True)
    )
    await db.commit()
