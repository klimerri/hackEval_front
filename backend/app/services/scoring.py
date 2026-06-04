from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.hackathon import Hackathon
from app.models.jury import JuryScore
from app.models.submission import Submission
from app.models.team import Team


async def recalc_final_score(db: AsyncSession, team_id: int) -> Submission | None:
    """Combine auto_score with jury averages using hackathon coefficients."""
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.submission))
        )
    ).scalar_one_or_none()
    if not team or not team.submission:
        return None
    sub = team.submission
    hack = (await db.execute(select(Hackathon).where(Hackathon.id == team.hackathon_id))).scalar_one()
    coefs = hack.coefficients or {"code": 40, "design": 30, "pitch": 30}
    total_w = sum(int(v) for v in coefs.values()) or 100

    auto = float(sub.auto_score or 0.0)
    jury_scores = (
        await db.execute(select(JuryScore).where(JuryScore.team_id == team_id))
    ).scalars().all()
    if jury_scores:
        jury_avg = sum((j.design + j.pitch + j.complexity) / 3 for j in jury_scores) / len(jury_scores)
    else:
        jury_avg = 0.0

    code_w = int(coefs.get("code", 0))
    design_w = int(coefs.get("design", 0))
    pitch_w = int(coefs.get("pitch", 0))

    final = (auto * code_w + jury_avg * (design_w + pitch_w)) / max(total_w, 1)
    sub.final_score = round(final, 2)
    sub.finished_at = sub.finished_at or datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(sub)
    return sub
