from datetime import datetime, timezone
from pathlib import Path

from app.core.celery_app import celery_app
from app.core.config import settings
from app.services.code_check import run_code_check
from app.workers.db import session_scope
from app.workers.helpers import ensure_check_row, finalise_submission

def _code_source(team) -> str | None:
    """Prefer an uploaded archive over the Git URL."""
    archive = Path(settings.upload_dir) / f"team_{team.id}" / "code.zip"
    if archive.exists():
        return str(archive)
    return team.github_url

@celery_app.task(name="app.workers.tasks_code.check_code_task", bind=True, max_retries=1)
def check_code_task(self, submission_id: int) -> dict:
    with session_scope() as db:
        from app.models.submission import CodeCheck, Submission
        from app.models.team import Team

        sub = db.get(Submission, submission_id)
        if not sub:
            return {"ok": False, "error": "submission not found"}
        team = db.get(Team, sub.team_id)
        check = ensure_check_row(db, CodeCheck, submission_id)
        check.status = "running"
        check.started_at = datetime.now(timezone.utc)
        db.commit()

        result = run_code_check(_code_source(team))
        for k, v in result.items():
            setattr(check, k, v)
        check.finished_at = datetime.now(timezone.utc)
        db.commit()
    finalise_submission(submission_id)
    return {"ok": True, "submission_id": submission_id}
