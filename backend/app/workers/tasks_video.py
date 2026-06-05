from datetime import datetime, timezone
from pathlib import Path

from app.core.celery_app import celery_app
from app.core.config import settings
from app.services.video_check import VIDEO_EXTS, run_video_check
from app.workers.db import session_scope
from app.workers.helpers import ensure_check_row, finalise_submission


def _video_source(team) -> str | None:
    """Prefer an uploaded video file over the URL."""
    base = Path(settings.upload_dir) / f"team_{team.id}"
    for ext in VIDEO_EXTS:
        p = base / f"video{ext}"
        if p.exists():
            return str(p)
    return team.video_url


@celery_app.task(name="app.workers.tasks_video.check_video_task", bind=True, max_retries=1)
def check_video_task(self, submission_id: int) -> dict:
    with session_scope() as db:
        from app.models.submission import Submission, VideoCheck
        from app.models.team import Team

        sub = db.get(Submission, submission_id)
        if not sub:
            return {"ok": False, "error": "submission not found"}
        team = db.get(Team, sub.team_id)
        check = ensure_check_row(db, VideoCheck, submission_id)
        check.status = "running"
        check.started_at = datetime.now(timezone.utc)
        db.commit()

        workdir = Path(settings.upload_dir) / f"submission_{submission_id}"
        result = run_video_check(_video_source(team), workdir)
        for k, v in result.items():
            setattr(check, k, v)
        check.finished_at = datetime.now(timezone.utc)
        db.commit()
    finalise_submission(submission_id)
    return {"ok": True, "submission_id": submission_id}
