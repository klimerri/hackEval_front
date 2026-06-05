from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.hackathon import Hackathon
from app.models.jury import JuryScore
from app.models.submission import Submission
from app.models.team import Team

AUTO_SHARE = 0.4
JURY_SHARE = 0.6

def weighted_jury_value(scores: dict | None, criteria: list | None) -> float:
    """Weighted average of one juror's per-criterion scores (0..10)."""
    scores = scores or {}
    if criteria:
        num = 0.0
        den = 0.0
        for c in criteria:
            if not isinstance(c, dict):
                continue
            key = c.get("key")
            weight = float(c.get("weight", 0) or 0)
            if key in scores and weight > 0:
                num += float(scores[key]) * weight
                den += weight
        if den > 0:
            return num / den
    vals = [float(v) for v in scores.values()]
    return sum(vals) / len(vals) if vals else 0.0

def jury_value_for(row: JuryScore, criteria: list | None) -> float:
    """Compute a juror's value, falling back to legacy columns for old rows."""
    scores = row.scores or {
        "design": row.design,
        "pitch": row.pitch,
        "complexity": row.complexity,
    }
    return weighted_jury_value(scores, criteria)

def combine_scores(auto: float, jury_avg: float) -> float:
    return round(auto * AUTO_SHARE + jury_avg * JURY_SHARE, 2)

async def recalc_final_score(db: AsyncSession, team_id: int) -> Submission | None:
    """Combine the (fixed) auto score with the weighted jury average."""
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.submission))
        )
    ).scalar_one_or_none()
    if not team or not team.submission:
        return None
    sub = team.submission
    hack = (await db.execute(select(Hackathon).where(Hackathon.id == team.hackathon_id))).scalar_one()
    criteria = hack.jury_criteria or []

    auto = float(sub.auto_score or 0.0)
    jury_scores = (
        await db.execute(select(JuryScore).where(JuryScore.team_id == team_id))
    ).scalars().all()
    jury_avg = (
        sum(jury_value_for(j, criteria) for j in jury_scores) / len(jury_scores)
        if jury_scores
        else 0.0
    )

    sub.final_score = combine_scores(auto, jury_avg)
    sub.finished_at = sub.finished_at or datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(sub)
    return sub
