import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_organizer
from app.models.hackathon import DEFAULT_JURY_CRITERIA, Hackathon, HackathonStatus
from app.models.jury import JuryAssignment
from app.models.team import Team
from app.models.user import User, UserRole
from app.schemas.hackathon import HackathonCreate, HackathonOut, HackathonUpdate

router = APIRouter()


def _to_out(h: Hackathon, teams_count: int, jury_count: int) -> HackathonOut:
    return HackathonOut(
        id=h.id,
        title=h.title,
        description=h.description,
        rules=h.rules or [],
        start_date=h.start_date,
        end_date=h.end_date,
        submission_deadline=h.submission_deadline,
        status=h.status.value,
        prize_pool=h.prize_pool,
        image_url=h.image_url,
        type=h.type,
        coefficients=h.coefficients or {"code": 40, "design": 30, "pitch": 30},
        jury_criteria=h.jury_criteria or list(DEFAULT_JURY_CRITERIA),
        max_team_size=h.max_team_size,
        organizer_id=h.organizer_id,
        teams_count=teams_count,
        jury_count=jury_count,
    )


@router.get("", response_model=list[HackathonOut])
async def list_hackathons(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[HackathonOut]:
    rows = (await db.execute(select(Hackathon).order_by(Hackathon.start_date.desc()))).scalars().all()
    result: list[HackathonOut] = []
    for h in rows:
        tc = await db.execute(select(func.count(Team.id)).where(Team.hackathon_id == h.id))
        jc = await db.execute(select(func.count(JuryAssignment.id)).where(JuryAssignment.hackathon_id == h.id))
        result.append(_to_out(h, tc.scalar() or 0, jc.scalar() or 0))
    return result


@router.get("/{hackathon_id}", response_model=HackathonOut)
async def get_hackathon(
    hackathon_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HackathonOut:
    res = await db.execute(select(Hackathon).where(Hackathon.id == hackathon_id))
    h = res.scalar_one_or_none()
    if not h:
        raise HTTPException(status_code=404, detail="hackathon not found")
    tc = await db.execute(select(func.count(Team.id)).where(Team.hackathon_id == h.id))
    jc = await db.execute(select(func.count(JuryAssignment.id)).where(JuryAssignment.hackathon_id == h.id))
    return _to_out(h, tc.scalar() or 0, jc.scalar() or 0)


@router.post("", response_model=HackathonOut, status_code=201)
async def create_hackathon(
    payload: HackathonCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_organizer),
) -> HackathonOut:
    h = Hackathon(
        title=payload.title,
        description=payload.description,
        rules=payload.rules,
        start_date=payload.start_date,
        end_date=payload.end_date,
        submission_deadline=payload.submission_deadline,
        status=HackathonStatus.ACTIVE,
        prize_pool=payload.prize_pool,
        image_url=payload.image_url,
        type=payload.type,
        coefficients=payload.coefficients,
        jury_criteria=[c.model_dump() for c in payload.jury_criteria],
        max_team_size=payload.max_team_size,
        organizer_id=user.id,
    )
    db.add(h)
    await db.commit()
    await db.refresh(h)
    return _to_out(h, 0, 0)


@router.patch("/{hackathon_id}", response_model=HackathonOut)
async def update_hackathon(
    hackathon_id: int,
    payload: HackathonUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_organizer),
) -> HackathonOut:
    res = await db.execute(select(Hackathon).where(Hackathon.id == hackathon_id))
    h = res.scalar_one_or_none()
    if not h:
        raise HTTPException(status_code=404, detail="hackathon not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "status" and value is not None:
            setattr(h, field, HackathonStatus(value))
        else:
            setattr(h, field, value)
    await db.commit()
    await db.refresh(h)
    tc = await db.execute(select(func.count(Team.id)).where(Team.hackathon_id == h.id))
    jc = await db.execute(select(func.count(JuryAssignment.id)).where(JuryAssignment.hackathon_id == h.id))
    return _to_out(h, tc.scalar() or 0, jc.scalar() or 0)


@router.get("/{hackathon_id}/invite")
async def get_invite(
    hackathon_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    res = await db.execute(select(Hackathon).where(Hackathon.id == hackathon_id))
    h = res.scalar_one_or_none()
    if not h:
        raise HTTPException(status_code=404, detail="hackathon not found")
    return {"invite_link": f"https://hackauth.com/join/{h.id}-{secrets.token_hex(4)}"}


@router.get("/mine/upcoming", response_model=list[HackathonOut])
async def my_hackathons(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[HackathonOut]:
    if user.role == UserRole.ORGANIZER:
        rows = (await db.execute(select(Hackathon).where(Hackathon.organizer_id == user.id))).scalars().all()
    else:
        rows = (await db.execute(select(Hackathon).order_by(Hackathon.start_date.desc()))).scalars().all()
    result: list[HackathonOut] = []
    for h in rows:
        tc = await db.execute(select(func.count(Team.id)).where(Team.hackathon_id == h.id))
        jc = await db.execute(select(func.count(JuryAssignment.id)).where(JuryAssignment.hackathon_id == h.id))
        result.append(_to_out(h, tc.scalar() or 0, jc.scalar() or 0))
    return result
