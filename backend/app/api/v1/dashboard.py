from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.hackathon import Hackathon, HackathonStatus
from app.models.jury import JuryAssignment, JuryScore
from app.models.team import Team, TeamMember, TeamStatus
from app.models.user import User, UserRole
from app.schemas.dashboard import AnnouncementOut, DashboardHackathonRow, DashboardOut, DashboardStats

router = APIRouter()

_ANNOUNCEMENTS = [
    ("Открыта регистрация на FinTech Days 2024", "Принимаем заявки до конца следующей недели. Призовой фонд 1 млн ₽."),
    ("Обновление модуля автотестов Python", "Добавлена поддержка новых ML-библиотек."),
    ("Хакатон AI Innovation Hack 2024", "До дедлайна подачи проектов осталось 2 дня."),
]


def _announcements() -> list[AnnouncementOut]:
    return [
        AnnouncementOut(id=i + 1, title=title, body=body, created_at=datetime.now(timezone.utc))
        for i, (title, body) in enumerate(_ANNOUNCEMENTS)
    ]


async def _participant_dashboard(db: AsyncSession, user: User) -> DashboardOut:
    active = await db.execute(
        select(func.count(Hackathon.id)).where(Hackathon.status == HackathonStatus.ACTIVE)
    )
    my_team_ids_q = select(TeamMember.team_id).where(TeamMember.user_id == user.id)
    my_teams = await db.execute(
        select(func.count(func.distinct(TeamMember.team_id))).where(TeamMember.user_id == user.id)
    )
    my_team_rows = (
        await db.execute(
            select(Team, Hackathon)
            .join(Hackathon, Hackathon.id == Team.hackathon_id)
            .where(Team.id.in_(my_team_ids_q))
            .options(selectinload(Team.members), selectinload(Team.submission))
        )
    ).all()

    rows: list[DashboardHackathonRow] = []
    pending = 0
    for team, hack in my_team_rows:
        score_str = "—"
        if team.submission and team.submission.status.value == "evaluated":
            score_str = f"{team.submission.final_score:.1f} / 10"
        else:
            pending += 1
        rows.append(
            DashboardHackathonRow(
                id=hack.id,
                title=hack.title,
                status=hack.status.value,
                deadline=hack.submission_deadline,
                team=team.name,
                score=score_str,
            )
        )

    stats = DashboardStats(
        active_hackathons=active.scalar() or 0,
        my_teams=my_teams.scalar() or 0,
        total_submissions=0,
        pending_evaluations=pending,
    )
    return DashboardOut(role="participant", stats=stats, my_hackathons=rows, announcements=_announcements())


async def _jury_dashboard(db: AsyncSession, user: User) -> DashboardOut:
    hack_ids = (
        await db.execute(select(JuryAssignment.hackathon_id).where(JuryAssignment.user_id == user.id))
    ).scalars().all()
    hacks = (
        (await db.execute(select(Hackathon).where(Hackathon.id.in_(hack_ids)))).scalars().all()
        if hack_ids
        else []
    )
    rows: list[DashboardHackathonRow] = []
    total_teams = 0
    total_graded = 0
    for h in hacks:
        total = (
            await db.execute(
                select(func.count(Team.id)).where(
                    Team.hackathon_id == h.id, Team.status == TeamStatus.APPROVED
                )
            )
        ).scalar() or 0
        graded = (
            await db.execute(
                select(func.count(func.distinct(JuryScore.team_id)))
                .join(Team, Team.id == JuryScore.team_id)
                .where(Team.hackathon_id == h.id, JuryScore.jury_id == user.id)
            )
        ).scalar() or 0
        total_teams += total
        total_graded += graded
        rows.append(
            DashboardHackathonRow(
                id=h.id,
                title=h.title,
                status=h.status.value,
                deadline=h.submission_deadline,
                team=f"{graded}/{total} оценено",
                score="—",
            )
        )
    stats = DashboardStats(
        assigned_hackathons=len(hacks),
        teams_to_grade=total_teams,
        graded_by_me=total_graded,
        pending_evaluations=max(0, total_teams - total_graded),
    )
    return DashboardOut(role="jury", stats=stats, my_hackathons=rows, announcements=_announcements())


async def _organizer_dashboard(db: AsyncSession, user: User) -> DashboardOut:
    hacks = (
        await db.execute(select(Hackathon).where(Hackathon.organizer_id == user.id))
    ).scalars().all()
    rows: list[DashboardHackathonRow] = []
    total_teams = 0
    pending_teams = 0
    jury_total = 0
    for h in hacks:
        teams = (
            await db.execute(select(func.count(Team.id)).where(Team.hackathon_id == h.id))
        ).scalar() or 0
        approved = (
            await db.execute(
                select(func.count(Team.id)).where(
                    Team.hackathon_id == h.id, Team.status == TeamStatus.APPROVED
                )
            )
        ).scalar() or 0
        pending = (
            await db.execute(
                select(func.count(Team.id)).where(
                    Team.hackathon_id == h.id, Team.status == TeamStatus.PENDING
                )
            )
        ).scalar() or 0
        jc = (
            await db.execute(
                select(func.count(JuryAssignment.id)).where(JuryAssignment.hackathon_id == h.id)
            )
        ).scalar() or 0
        total_teams += teams
        pending_teams += pending
        jury_total += jc
        rows.append(
            DashboardHackathonRow(
                id=h.id,
                title=h.title,
                status=h.status.value,
                deadline=h.submission_deadline,
                team=f"{teams} команд",
                score=f"{approved} одобрено",
            )
        )
    stats = DashboardStats(
        managed_hackathons=len(hacks),
        total_teams=total_teams,
        pending_teams=pending_teams,
        jury_total=jury_total,
    )
    return DashboardOut(role="organizer", stats=stats, my_hackathons=rows, announcements=_announcements())


@router.get("", response_model=DashboardOut)
async def dashboard(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> DashboardOut:
    if user.role == UserRole.JURY:
        return await _jury_dashboard(db, user)
    if user.role == UserRole.ORGANIZER:
        return await _organizer_dashboard(db, user)
    return await _participant_dashboard(db, user)
