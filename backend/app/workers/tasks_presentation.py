from datetime import datetime, timezone
from pathlib import Path

from app.core.celery_app import celery_app
from app.core.config import settings
from app.services.presentation_check import run_presentation_check
from app.workers.db import session_scope
from app.workers.helpers import ensure_check_row, finalise_submission

PRES_EXTS = (".pdf", ".pptx")

def _presentation_source(team) -> str | None:
    """Prefer an uploaded presentation file over the URL."""
    base = Path(settings.upload_dir) / f"team_{team.id}"
    for ext in PRES_EXTS:
        p = base / f"presentation{ext}"
        if p.exists():
            return str(p)
    return team.presentation_url

@celery_app.task(name="app.workers.tasks_presentation.check_presentation_task", bind=True, max_retries=1)
def check_presentation_task(self, submission_id: int) -> dict:
    with session_scope() as db:
        from app.models.hackathon import Hackathon
        from app.models.submission import PresentationCheck, Submission
        from app.models.team import Team

        sub = db.get(Submission, submission_id)
        if not sub:
            return {"ok": False, "error": "submission not found"}
        team = db.get(Team, sub.team_id)
        check = ensure_check_row(db, PresentationCheck, submission_id)
        check.status = "running"
        check.started_at = datetime.now(timezone.utc)
        db.commit()

        hack = db.get(Hackathon, team.hackathon_id)
        sections = (hack.presentation_sections or []) if hack else []
        result = run_presentation_check(_presentation_source(team), sections)
        for k, v in result.items():
            setattr(check, k, v)
        check.finished_at = datetime.now(timezone.utc)
        db.commit()
    finalise_submission(submission_id)
    return {"ok": True, "submission_id": submission_id}
