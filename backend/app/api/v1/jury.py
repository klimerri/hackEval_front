
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.hackathon import Hackathon
from app.models.jury import JuryAssignment, JuryScore
from app.models.submission import Submission
from app.models.team import Team, TeamMember, TeamStatus
from app.models.user import User, UserRole
from app.schemas.submission import JuryScoreIn, JuryScoreOut
from app.services.scoring import recalc_final_score

router = APIRouter()


def _checks_summary(sub: Submission | None) -> dict | None:
    """Compact auto-check breakdown for the jury panel (per TZ §6)."""
    if sub is None:
        return None

    def _st(c) -> str:
        if not c:
            return "skipped"
        return getattr(c.status, "value", c.status)

    def _score(c) -> float | None:
        return round(c.score, 1) if c else None

    code = sub.code_check
    doc = sub.doc_check
    pres = sub.presentation_check
    vid = sub.video_check
    return {
        "code": {
            "status": _st(code),
            "score": _score(code),
            "loc": code.loc if code else 0,
            "lint_issues": code.lint_issues if code else 0,
            "secrets_found": code.secrets_found if code else 0,
            "has_readme": bool(code.has_readme) if code else False,
        },
        "doc": {
            "status": _st(doc),
            "score": _score(doc),
            "word_count": doc.word_count if doc else 0,
            "fmt": doc.fmt if doc else "",
        },
        "presentation": {
            "status": _st(pres),
            "score": _score(pres),
            "slide_count": pres.slide_count if pres else 0,
            "fmt": pres.fmt if pres else "",
        },
        "video": {
            "status": _st(vid),
            "score": _score(vid),
            "duration_sec": vid.duration_sec if vid else 0,
            "summary": (vid.summary or "") if vid else "",
        },
    }


@router.get("/hackathons", response_model=list[dict])
async def my_jury_hackathons(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    if user.role not in (UserRole.JURY, UserRole.ORGANIZER):
        raise HTTPException(status_code=403, detail="jury only")
    if user.role == UserRole.ORGANIZER:
        rows = (await db.execute(select(Hackathon).where(Hackathon.organizer_id == user.id))).scalars().all()
    else:
        ids = (await db.execute(select(JuryAssignment.hackathon_id).where(JuryAssignment.user_id == user.id))).scalars().all()
        rows = (await db.execute(select(Hackathon).where(Hackathon.id.in_(ids)))).scalars().all() if ids else []
    result: list[dict] = []
    for h in rows:
        total = (await db.execute(select(func.count(Team.id)).where(Team.hackathon_id == h.id, Team.status == TeamStatus.APPROVED))).scalar() or 0
        graded = (
            await db.execute(
                select(func.count(func.distinct(JuryScore.team_id)))
                .join(Team, Team.id == JuryScore.team_id)
                .where(Team.hackathon_id == h.id, JuryScore.jury_id == user.id)
            )
        ).scalar() or 0
        result.append(
            {
                "id": h.id,
                "title": h.title,
                "teams_count": total,
                "graded_count": graded,
                "deadline": h.submission_deadline.isoformat(),
                "status": "in_progress" if graded < total else "finished",
            }
        )
    return result


@router.get("/hackathons/{hackathon_id}/teams", response_model=list[dict])
async def list_teams_for_jury(
    hackathon_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    teams = (
        await db.execute(
            select(Team)
            .where(Team.hackathon_id == hackathon_id, Team.status == TeamStatus.APPROVED)
            .options(
                selectinload(Team.members).selectinload(TeamMember.user),
                selectinload(Team.submission).selectinload(Submission.code_check),
                selectinload(Team.submission).selectinload(Submission.doc_check),
                selectinload(Team.submission).selectinload(Submission.presentation_check),
                selectinload(Team.submission).selectinload(Submission.video_check),
                selectinload(Team.jury_scores),
            )
        )
    ).scalars().all()
    result: list[dict] = []
    for t in teams:
        captain = next((m.user.name for m in t.members if m.role.value == "captain"), "")
        my_score = next((s for s in (t.jury_scores or []) if s.jury_id == user.id), None)
        sub = t.submission
        auto = sub.auto_score if sub else 0.0
        result.append(
            {
                "id": t.id,
                "name": t.name,
                "captain": captain,
                "auto_score": auto,
                "github": t.github_url,
                "docs": t.docs_url,
                "video": t.video_url,
                "presentation": t.presentation_url,
                "status": "evaluated" if my_score else "pending",
                "checks": _checks_summary(sub),
                "my_score": {
                    "scores": my_score.scores
                    or {
                        "design": my_score.design,
                        "pitch": my_score.pitch,
                        "complexity": my_score.complexity,
                    },
                    "comment": my_score.comment,
                }
                if my_score
                else None,
            }
        )
    return result


@router.put("/teams/{team_id}/score", response_model=JuryScoreOut)
async def save_score(
    team_id: int,
    payload: JuryScoreIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JuryScoreOut:
    team = (await db.execute(select(Team).where(Team.id == team_id))).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="team not found")
    if user.role not in (UserRole.JURY, UserRole.ORGANIZER):
        raise HTTPException(status_code=403, detail="jury only")
    scores = payload.scores or {}
    existing = (
        await db.execute(select(JuryScore).where(JuryScore.team_id == team_id, JuryScore.jury_id == user.id))
    ).scalar_one_or_none()
    if existing:
        existing.scores = scores
        existing.comment = payload.comment
        # keep legacy columns roughly in sync for back-compat
        existing.design = int(scores.get("design", 0))
        existing.pitch = int(scores.get("pitch", 0))
        existing.complexity = int(scores.get("complexity", 0))
    else:
        existing = JuryScore(
            team_id=team_id,
            jury_id=user.id,
            scores=scores,
            design=int(scores.get("design", 0)),
            pitch=int(scores.get("pitch", 0)),
            complexity=int(scores.get("complexity", 0)),
            comment=payload.comment,
        )
        db.add(existing)
    await db.commit()
    await db.refresh(existing)
    await recalc_final_score(db, team_id)
    jury_user = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
    return JuryScoreOut(
        id=existing.id,
        team_id=existing.team_id,
        jury_id=existing.jury_id,
        jury_name=jury_user.name,
        scores=existing.scores or {},
        comment=existing.comment,
    )
