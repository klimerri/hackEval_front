"""Shared helpers for Celery check tasks."""
from __future__ import annotations

from datetime import datetime, timezone

from app.workers.db import session_scope
from sqlalchemy.orm import Session


def ensure_check_row(db: Session, model, submission_id: int):
    """Get-or-create the singleton check row for a submission."""
    obj = db.query(model).filter(model.submission_id == submission_id).one_or_none()
    if obj is None:
        obj = model(submission_id=submission_id, status="pending")
        db.add(obj)
        db.commit()
        db.refresh(obj)
    return obj


def finalise_submission(submission_id: int) -> None:
    """If all 4 checks are done, mark the submission evaluated and compute auto score."""
    from app.models.hackathon import Hackathon
    from app.models.jury import JuryScore
    from app.models.submission import (
        CodeCheck,
        DocCheck,
        PresentationCheck,
        Submission,
        SubmissionStatus,
        VideoCheck,
    )
    from app.models.team import Team

    with session_scope() as db:
        sub = db.get(Submission, submission_id)
        if not sub:
            return
        statuses: list[str] = []
        for cls in (CodeCheck, DocCheck, PresentationCheck, VideoCheck):
            row = db.query(cls).filter(cls.submission_id == submission_id).one_or_none()
            if row is None:
                return
            statuses.append(row.status.value if hasattr(row.status, "value") else row.status)
        if any(s in ("pending", "running") for s in statuses):
            return
        code = db.query(CodeCheck).filter(CodeCheck.submission_id == submission_id).one()
        doc = db.query(DocCheck).filter(DocCheck.submission_id == submission_id).one()
        pres = db.query(PresentationCheck).filter(PresentationCheck.submission_id == submission_id).one()
        vid = db.query(VideoCheck).filter(VideoCheck.submission_id == submission_id).one()
        sub.auto_score = round(
            (code.score or 0) * 0.4
            + (doc.score or 0) * 0.25
            + (pres.score or 0) * 0.2
            + (vid.score or 0) * 0.15,
            2,
        )
        sub.status = SubmissionStatus.EVALUATED
        sub.finished_at = datetime.now(timezone.utc)
        db.commit()

        team = db.get(Team, sub.team_id)
        if team:
            hack = db.get(Hackathon, team.hackathon_id)
            coefs = hack.coefficients or {"code": 40, "design": 30, "pitch": 30}
            code_w = int(coefs.get("code", 0))
            design_w = int(coefs.get("design", 0))
            pitch_w = int(coefs.get("pitch", 0))
            total_w = max(1, code_w + design_w + pitch_w)
            jury = db.query(JuryScore).filter(JuryScore.team_id == team.id).all()
            jury_avg = (
                sum((j.design + j.pitch + j.complexity) / 3 for j in jury) / len(jury)
                if jury
                else 0.0
            )
            sub.final_score = round(
                (sub.auto_score * code_w + jury_avg * (design_w + pitch_w)) / total_w,
                2,
            )
            db.commit()
