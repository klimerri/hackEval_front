from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.jury import JuryScore
from app.models.submission import (
    CodeCheck,
    DocCheck,
    PresentationCheck,
    Submission,
    SubmissionStatus,
    VideoCheck,
)
from app.models.team import Team, TeamMember, TeamStatus
from app.models.user import User
from app.schemas.submission import (
    CodeCheckOut,
    DocCheckOut,
    HackathonWinnerOut,
    PresentationCheckOut,
    SubmissionOut,
    TeamResultOut,
    VideoCheckOut,
)
from app.services.scoring import recalc_final_score

router = APIRouter()


def _submission_out(s: Submission) -> SubmissionOut:
    def _code(c: CodeCheck | None) -> CodeCheckOut | None:
        if not c:
            return None
        return CodeCheckOut.model_validate(c)

    def _doc(c: DocCheck | None) -> DocCheckOut | None:
        if not c:
            return None
        return DocCheckOut.model_validate(c)

    def _pres(c: PresentationCheck | None) -> PresentationCheckOut | None:
        if not c:
            return None
        return PresentationCheckOut.model_validate(c)

    def _vid(c: VideoCheck | None) -> VideoCheckOut | None:
        if not c:
            return None
        return VideoCheckOut.model_validate(c)

    return SubmissionOut(
        id=s.id,
        team_id=s.team_id,
        status=s.status.value,
        auto_score=s.auto_score,
        final_score=s.final_score,
        rank=s.rank,
        created_at=s.created_at,
        finished_at=s.finished_at,
        code_check=_code(s.code_check),
        doc_check=_doc(s.doc_check),
        presentation_check=_pres(s.presentation_check),
        video_check=_vid(s.video_check),
    )


@router.get("/me", response_model=list[SubmissionOut])
async def my_results(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SubmissionOut]:
    q = (
        select(Submission)
        .join(Team, Team.id == Submission.team_id)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .where(TeamMember.user_id == user.id)
        .options(
            selectinload(Submission.code_check),
            selectinload(Submission.doc_check),
            selectinload(Submission.presentation_check),
            selectinload(Submission.video_check),
        )
    )
    rows = (await db.execute(q)).scalars().unique().all()
    out: list[SubmissionOut] = []
    for s in rows:
        item = _submission_out(s)
        jscores = (
            await db.execute(select(JuryScore).where(JuryScore.team_id == s.team_id))
        ).scalars().all()
        if jscores:
            item.jury_score = round(
                sum((j.design + j.pitch + j.complexity) / 3 for j in jscores) / len(jscores), 2
            )
        out.append(item)
    return out


@router.get("/hackathons/{hackathon_id}/ranking", response_model=list[TeamResultOut])
async def hackathon_ranking(
    hackathon_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TeamResultOut]:
    teams = (
        await db.execute(
            select(Team)
            .where(Team.hackathon_id == hackathon_id, Team.status == TeamStatus.APPROVED)
            .options(selectinload(Team.submission), selectinload(Team.jury_scores))
        )
    ).scalars().all()
    out: list[TeamResultOut] = []
    for t in teams:
        s = t.submission
        if s is None:
            out.append(
                TeamResultOut(
                    team_id=t.id,
                    team_name=t.name,
                    hackathon_id=hackathon_id,
                    status="pending",
                    auto_score=0.0,
                    jury_score=None,
                    final_score=0.0,
                    rank=None,
                )
            )
            continue
        if s.status == SubmissionStatus.EVALUATED:
            await recalc_final_score(db, t.id)
            await db.refresh(s)
        jury_avg = None
        if t.jury_scores:
            jury_avg = sum((j.design + j.pitch + j.complexity) / 3 for j in t.jury_scores) / len(t.jury_scores)
        out.append(
            TeamResultOut(
                team_id=t.id,
                team_name=t.name,
                hackathon_id=hackathon_id,
                status=s.status.value,
                auto_score=s.auto_score,
                jury_score=jury_avg,
                final_score=s.final_score,
                rank=s.rank,
            )
        )
    out.sort(key=lambda r: r.final_score, reverse=True)
    for i, row in enumerate(out, start=1):
        if row.final_score > 0 and row.status == "evaluated":
            row.rank = i
    return out


@router.get("/hackathons/{hackathon_id}/winners", response_model=list[HackathonWinnerOut])
async def hackathon_winners(
    hackathon_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[HackathonWinnerOut]:
    ranking = await hackathon_ranking(hackathon_id, db, user)
    top = [r for r in ranking if r.final_score > 0][:3]
    return [
        HackathonWinnerOut(rank=i + 1, team_id=r.team_id, team_name=r.team_name, final_score=r.final_score)
        for i, r in enumerate(top)
    ]


@router.post("/submissions/{submission_id}/rerun", response_model=SubmissionOut)
async def rerun_checks(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SubmissionOut:
    sub = (
        await db.execute(
            select(Submission)
            .where(Submission.id == submission_id)
            .options(
                selectinload(Submission.code_check),
                selectinload(Submission.doc_check),
                selectinload(Submission.presentation_check),
                selectinload(Submission.video_check),
            )
        )
    ).scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="submission not found")
    sub.status = SubmissionStatus.PENDING
    sub.finished_at = None
    if sub.code_check:
        sub.code_check.status = "pending"
    if sub.doc_check:
        sub.doc_check.status = "pending"
    if sub.presentation_check:
        sub.presentation_check.status = "pending"
    if sub.video_check:
        sub.video_check.status = "pending"
    await db.commit()
    from app.workers.dispatcher import dispatch_checks
    await dispatch_checks(sub.team_id, submission_id=sub.id)
    return _submission_out(sub)
