from datetime import datetime, timezone

from app.core.celery_app import celery_app
from app.services.doc_check import run_doc_check
from app.workers.db import session_scope
from app.workers.helpers import ensure_check_row, finalise_submission


@celery_app.task(name="app.workers.tasks_docs.check_docs_task", bind=True, max_retries=1)
def check_docs_task(self, submission_id: int) -> dict:
    with session_scope() as db:
        from app.models.submission import DocCheck, Submission
        from app.models.team import Team

        sub = db.get(Submission, submission_id)
        if not sub:
            return {"ok": False, "error": "submission not found"}
        team = db.get(Team, sub.team_id)
        check = ensure_check_row(db, DocCheck, submission_id)
        check.status = "running"
        check.started_at = datetime.now(timezone.utc)
        db.commit()

        result = run_doc_check(team.docs_url)
        for k, v in result.items():
            setattr(check, k, v)
        check.finished_at = datetime.now(timezone.utc)
        db.commit()
    finalise_submission(submission_id)
    return {"ok": True, "submission_id": submission_id}
