"""Helpers to create in-app notifications.

These add Notification rows to the session WITHOUT committing — the caller
commits as part of its own transaction so notifications stay consistent with
the action that triggered them.
"""
from collections.abc import Iterable

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType

def notify(
    db: AsyncSession,
    user_id: int,
    title: str,
    body: str = "",
    type: NotificationType = NotificationType.INFO,
) -> None:
    db.add(Notification(user_id=user_id, title=title, body=body, type=type))

def notify_many(
    db: AsyncSession,
    user_ids: Iterable[int],
    title: str,
    body: str = "",
    type: NotificationType = NotificationType.INFO,
) -> None:
    seen: set[int] = set()
    for uid in user_ids:
        if uid in seen:
            continue
        seen.add(uid)
        db.add(Notification(user_id=uid, title=title, body=body, type=type))
