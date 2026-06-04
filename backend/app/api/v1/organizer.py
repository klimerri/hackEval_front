from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import require_organizer
from app.core.security import hash_password
from app.models.hackathon import Hackathon
from app.models.jury import JuryAssignment
from app.models.team import Team, TeamMember, TeamStatus
from app.models.user import User, UserRole
from app.schemas.algorithm import JuryAssignIn
from app.schemas.auth import UserOut
from app.schemas.organizer import AssignedJuryOut, JuryCreateIn, JuryPromoteIn

router = APIRouter()


@router.get("/jury-pool", response_model=list[dict])
async def jury_pool(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_organizer),
) -> list[dict]:
    # Only actual jury can be assigned — organizers must not appear in the pool.
    rows = (await db.execute(select(User).where(User.role == UserRole.JURY))).scalars().all()
    return [
        {"id": u.id, "name": u.name, "email": u.email, "role": u.role.value, "company": u.company, "specialization": u.specialization}
        for u in rows
    ]


async def _ensure_owned_hackathon(db: AsyncSession, hackathon_id: int, user: User) -> Hackathon:
    h = (await db.execute(select(Hackathon).where(Hackathon.id == hackathon_id))).scalar_one_or_none()
    if not h or h.organizer_id != user.id:
        raise HTTPException(status_code=404, detail="hackathon not found")
    return h


@router.get("/hackathons/{hackathon_id}/jury", response_model=list[AssignedJuryOut])
async def list_assigned_jury(
    hackathon_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_organizer),
) -> list[AssignedJuryOut]:
    await _ensure_owned_hackathon(db, hackathon_id, user)
    rows = (
        await db.execute(
            select(User)
            .join(JuryAssignment, JuryAssignment.user_id == User.id)
            .where(JuryAssignment.hackathon_id == hackathon_id)
            .order_by(User.name)
        )
    ).scalars().all()
    return [
        AssignedJuryOut(
            id=u.id, name=u.name, email=u.email, company=u.company, specialization=u.specialization
        )
        for u in rows
    ]


@router.post("/jury/promote", response_model=UserOut, status_code=201)
async def promote_to_jury(
    payload: JuryPromoteIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_organizer),
) -> UserOut:
    target = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="user not found")
    if target.role == UserRole.ORGANIZER:
        raise HTTPException(status_code=400, detail="cannot change an organizer's role")
    target.role = UserRole.JURY
    if payload.company is not None:
        target.company = payload.company
    if payload.specialization is not None:
        target.specialization = payload.specialization
    await db.commit()
    await db.refresh(target)
    return UserOut.model_validate(target)


@router.post("/jury", response_model=UserOut, status_code=201)
async def create_jury(
    payload: JuryCreateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_organizer),
) -> UserOut:
    existing = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="email already registered")
    new_jury = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.JURY,
        company=payload.company,
        specialization=payload.specialization,
    )
    db.add(new_jury)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="email already registered") from exc
    await db.refresh(new_jury)
    return UserOut.model_validate(new_jury)


@router.post("/hackathons/{hackathon_id}/jury", status_code=201)
async def assign_jury(
    hackathon_id: int,
    payload: JuryAssignIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_organizer),
) -> dict:
    await _ensure_owned_hackathon(db, hackathon_id, user)
    u = (await db.execute(select(User).where(User.id == payload.user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="user not found")
    if u.role != UserRole.JURY:
        raise HTTPException(status_code=400, detail="only jury users can be assigned")
    existing = (await db.execute(select(JuryAssignment).where(JuryAssignment.hackathon_id == hackathon_id, JuryAssignment.user_id == payload.user_id))).scalar_one_or_none()
    if existing:
        return {"id": existing.id, "hackathon_id": hackathon_id, "user_id": payload.user_id}
    ja = JuryAssignment(hackathon_id=hackathon_id, user_id=payload.user_id)
    db.add(ja)
    await db.commit()
    return {"id": ja.id, "hackathon_id": hackathon_id, "user_id": payload.user_id}


@router.delete("/hackathons/{hackathon_id}/jury/{user_id}", status_code=204)
async def unassign_jury(
    hackathon_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_organizer),
) -> None:
    await _ensure_owned_hackathon(db, hackathon_id, user)
    ja = (await db.execute(select(JuryAssignment).where(JuryAssignment.hackathon_id == hackathon_id, JuryAssignment.user_id == user_id))).scalar_one_or_none()
    if ja:
        await db.delete(ja)
        await db.commit()


@router.get("/teams", response_model=list[dict])
async def organizer_teams(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_organizer),
) -> list[dict]:
    """All teams across the organizer's hackathons (for the organizer Teams tab)."""
    hack_ids_q = select(Hackathon.id).where(Hackathon.organizer_id == user.id)
    titles = dict(
        (await db.execute(select(Hackathon.id, Hackathon.title).where(Hackathon.organizer_id == user.id))).all()
    )
    teams = (
        await db.execute(
            select(Team)
            .where(Team.hackathon_id.in_(hack_ids_q))
            .options(selectinload(Team.members).selectinload(TeamMember.user))
            .order_by(Team.hackathon_id, Team.applied_at.desc())
        )
    ).scalars().all()
    result: list[dict] = []
    for t in teams:
        result.append(
            {
                "id": t.id,
                "name": t.name,
                "status": t.status.value,
                "hackathon_id": t.hackathon_id,
                "hackathon_title": titles.get(t.hackathon_id, f"Хакатон #{t.hackathon_id}"),
                "github_url": t.github_url,
                "applied_at": t.applied_at.isoformat() if t.applied_at else None,
                "members": [
                    {
                        "id": m.id,
                        "user_id": m.user_id,
                        "name": m.user.name if m.user else "",
                        "email": m.user.email if m.user else "",
                        "role": m.role.value,
                    }
                    for m in (t.members or [])
                ],
            }
        )
    return result


@router.get("/analytics", response_model=dict)
async def analytics(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_organizer),
) -> dict:
    rows = (await db.execute(select(Hackathon).where(Hackathon.organizer_id == user.id))).scalars().all()
    items = []
    for h in rows:
        apps = (await db.execute(select(func.count(Team.id)).where(Team.hackathon_id == h.id))).scalar() or 0
        approved = (await db.execute(select(func.count(Team.id)).where(Team.hackathon_id == h.id, Team.status == TeamStatus.APPROVED))).scalar() or 0
        items.append({"id": h.id, "title": h.title, "students": apps, "approved": approved})
    jury_total = (await db.execute(select(func.count(User.id)).where(User.role.in_([UserRole.JURY, UserRole.ORGANIZER])))).scalar() or 0
    return {
        "participation": items,
        "total_applications": sum(i["students"] for i in items),
        "avg_score": 7.8,
        "active_jury": jury_total,
        "prize_pool_total": "2.5M",
    }
