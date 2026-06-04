"""Sync DB helpers for Celery tasks.

Celery worker is a separate process. We use SQLAlchemy sync engine here to
keep the worker code simple and avoid event-loop entanglement.
"""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.database import Base
import app.models  # noqa: F401  ensure models registered

_sync_engine = create_engine(settings.sync_database_url, pool_pre_ping=True, future=True)
SyncSessionLocal = sessionmaker(bind=_sync_engine, autoflush=False, expire_on_commit=False)


@contextmanager
def session_scope() -> Iterator[Session]:
    s = SyncSessionLocal()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()
