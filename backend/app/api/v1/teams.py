import secrets
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_organizer, require_participant
from app.models.hackathon import Hackathon
from app.models.notification import NotificationType
from app.models.submission import Submission
from app.models.team import (
    Team,
    TeamMember,
    TeamMemberRole,
    TeamStatus,
    TeamJoinRequest,
    JoinRequestStatus,
)
from app.models.user import User, UserRole
from app.schemas.team import (
    JoinRequestCreate,
    JoinRequestDecision,
    JoinRequestOut,
    SubmissionUpdate,
    TeamAddManual,
    TeamCreate,
    TeamDecision,
    TeamMemberOut,
    TeamOut,
    TeamUpdate,
)
from app.services.notify import notify, notify_many

router = APIRouter()


def _archive_path(team_id: int) -> Path:
    return Path(settings.upload_dir) / f"team_{team_id}" / "code.zip"


DOC_EXTS = (".pdf", ".docx", ".md")
PRES_EXTS = (".pdf", ".pptx")
VIDEO_EXTS = (".mp4", ".mov", ".webm", ".mkv", ".avi")


def _doc_file_path(team_id: int) -> Path | None:
    """Return the uploaded documentation file for a team, if any."""
    base = Path(settings.upload_dir) / f"team_{team_id}"
    for ext in DOC_EXTS:
        p = base / f"docs{ext}"
        if p.exists():
            return p
    return None


def _presentation_file_path(team_id: int) -> Path | None:
    """Return the uploaded presentation file for a team, if any."""
    base = Path(settings.upload_dir) / f"team_{team_id}"
    for ext in PRES_EXTS:
        p = base / f"presentation{ext}"
        if p.exists():
            return p
    return None


def _video_file_path(team_id: int) -> Path | None:
    """Return the uploaded video (screencast) file for a team, if any."""
    base = Path(settings.upload_dir) / f"team_{team_id}"
    for ext in VIDEO_EXTS:
        p = base / f"video{ext}"
        if p.exists():
            return p
    return None


def _team_out(team: Team) -> TeamOut:
    return TeamOut(
        id=team.id,
        name=team.name,
        hackathon_id=team.hackathon_id,
        status=team.status.value,
        invite_code=team.invite_code,
        github_url=team.github_url,
        docs_url=team.docs_url,
        presentation_url=team.presentation_url,
        video_url=team.video_url,
        notes=team.notes,
        has_archive=_archive_path(team.id).exists(),
        has_doc_file=_doc_file_path(team.id) is not None,
        has_presentation_file=_presentation_file_path(team.id) is not None,
        has_video_file=_video_file_path(team.id) is not None,
        applied_at=team.applied_at,
        decided_at=team.decided_at,
        members=[
            TeamMemberOut(
                id=m.id,
                user_id=m.user_id,
                name=m.user.name,
                email=m.user.email,
                role=m.role.value,
            )
            for m in (team.members or [])
        ],
    )


def _join_request_out(req: TeamJoinRequest) -> JoinRequestOut:
    return JoinRequestOut(
        id=req.id,
        team_id=req.team_id,
        user_id=req.user_id,
        status=req.status.value,
        message=req.message or "",
        created_at=req.created_at,
        decided_at=req.decided_at,
        user_name=req.user.name if req.user else "",
        user_email=req.user.email if req.user else "",
    )


async def _check_user_in_hackathon(db: AsyncSession, user_id: int, hackathon_id: int) -> bool:
    """Check if user is already a member of any team in this hackathon."""
    result = await db.execute(
        select(TeamMember)
        .join(Team, Team.id == TeamMember.team_id)
        .where(Team.hackathon_id == hackathon_id, TeamMember.user_id == user_id)
    )
    return result.scalar_one_or_none() is not None


@router.get("", response_model=list[TeamOut])
async def list_my_teams(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TeamOut]:
    q = (
        select(Team)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .where(TeamMember.user_id == user.id)
        .options(selectinload(Team.members).selectinload(TeamMember.user))
    )
    rows = (await db.execute(q)).scalars().all()
    return [_team_out(t) for t in rows]


@router.get("/explore", response_model=list[TeamOut])
async def explore_teams(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TeamOut]:
    q = (
        select(Team)
        .where(Team.status == TeamStatus.APPROVED)
        .options(selectinload(Team.members).selectinload(TeamMember.user))
    )
    rows = (await db.execute(q)).scalars().all()
    my_team_ids = set(
        (await db.execute(select(TeamMember.team_id).where(TeamMember.user_id == user.id))).scalars().all()
    )
    return [_team_out(t) for t in rows if t.id not in my_team_ids and t.status == TeamStatus.APPROVED]


@router.post("", response_model=TeamOut, status_code=201)
async def create_team(
    payload: TeamCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_participant),
) -> TeamOut:
    h = (await db.execute(select(Hackathon).where(Hackathon.id == payload.hackathon_id))).scalar_one_or_none()
    if not h:
        raise HTTPException(status_code=404, detail="hackathon not found")

    if await _check_user_in_hackathon(db, user.id, payload.hackathon_id):
        raise HTTPException(status_code=400, detail="already participating in this hackathon")

    team = Team(
        name=payload.name,
        hackathon_id=payload.hackathon_id,
        status=TeamStatus.PENDING,
        invite_code=secrets.token_urlsafe(8),
        notes=payload.notes,
    )
    db.add(team)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail="team name already exists in this hackathon") from exc
    captain = TeamMember(team_id=team.id, user_id=user.id, role=TeamMemberRole.CAPTAIN)
    db.add(captain)
    for email in payload.members:
        u = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if u and u.id != user.id:
            if not await _check_user_in_hackathon(db, u.id, payload.hackathon_id):
                db.add(TeamMember(team_id=team.id, user_id=u.id, role=TeamMemberRole.MEMBER))
    await db.commit()
    team = (
        await db.execute(
            select(Team).where(Team.id == team.id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one()
    return _team_out(team)


@router.post("/manual", response_model=TeamOut, status_code=201)
async def create_team_manual(
    payload: TeamAddManual,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_organizer),
) -> TeamOut:
    """Organizer adds an approved team without becoming a member of it.

    The captain is attached by email (must be a participant). The organizer
    never joins the team, so they cannot become a hackathon participant.
    """
    h = (await db.execute(select(Hackathon).where(Hackathon.id == payload.hackathon_id))).scalar_one_or_none()
    if not h:
        raise HTTPException(status_code=404, detail="hackathon not found")
    if h.organizer_id != user.id:
        raise HTTPException(status_code=403, detail="not your hackathon")

    captain = (await db.execute(select(User).where(User.email == payload.captain_email))).scalar_one_or_none()
    if not captain:
        raise HTTPException(status_code=404, detail="captain user not found")
    if captain.role != UserRole.PARTICIPANT:
        raise HTTPException(status_code=400, detail="captain must be a participant")
    if await _check_user_in_hackathon(db, captain.id, payload.hackathon_id):
        raise HTTPException(status_code=400, detail="captain already participates in this hackathon")

    team = Team(
        name=payload.name,
        hackathon_id=payload.hackathon_id,
        status=TeamStatus.APPROVED,
        invite_code=secrets.token_urlsafe(8),
        notes="",
        decided_at=datetime.now(timezone.utc),
    )
    db.add(team)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail="team name already exists in this hackathon") from exc
    db.add(TeamMember(team_id=team.id, user_id=captain.id, role=TeamMemberRole.CAPTAIN))
    notify(
        db,
        captain.id,
        "Вас назначили капитаном",
        f"Организатор добавил команду «{team.name}» на хакатон «{h.title}».",
        NotificationType.TEAM_DECISION,
    )
    await db.commit()
    team = (
        await db.execute(
            select(Team).where(Team.id == team.id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one()
    return _team_out(team)


@router.post("/{team_id}/join", response_model=JoinRequestOut, status_code=201)
async def request_join_team(
    team_id: int,
    payload: JoinRequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_participant),
) -> JoinRequestOut:
    team = (await db.execute(select(Team).where(Team.id == team_id))).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="team not found")
    if team.status != TeamStatus.APPROVED:
        raise HTTPException(status_code=400, detail="team is not open for applications")

    members = (await db.execute(select(TeamMember).where(TeamMember.team_id == team.id))).scalars().all()
    if any(m.user_id == user.id for m in members):
        raise HTTPException(status_code=400, detail="already a member")

    hack = (await db.execute(select(Hackathon).where(Hackathon.id == team.hackathon_id))).scalar_one()
    if len(members) >= hack.max_team_size:
        raise HTTPException(status_code=400, detail="team is full")

    if await _check_user_in_hackathon(db, user.id, team.hackathon_id):
        raise HTTPException(status_code=400, detail="already participating in this hackathon")

    existing_request = (
        await db.execute(
            select(TeamJoinRequest).where(
                TeamJoinRequest.team_id == team_id,
                TeamJoinRequest.user_id == user.id,
                TeamJoinRequest.status == JoinRequestStatus.PENDING,
            )
        )
    ).scalar_one_or_none()
    if existing_request:
        raise HTTPException(status_code=400, detail="join request already pending")

    request = TeamJoinRequest(
        team_id=team_id,
        user_id=user.id,
        status=JoinRequestStatus.PENDING,
        message=payload.message,
    )
    db.add(request)
    captain = next((m for m in members if m.role == TeamMemberRole.CAPTAIN), None)
    if captain:
        notify(
            db,
            captain.user_id,
            "Новая заявка в команду",
            f"{user.name} хочет вступить в команду «{team.name}».",
            NotificationType.JOIN_REQUEST,
        )
    await db.commit()
    await db.refresh(request, attribute_names=["user"])
    return _join_request_out(request)


@router.get("/{team_id}/requests", response_model=list[JoinRequestOut])
async def list_join_requests(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[JoinRequestOut]:
    team = (await db.execute(select(Team).where(Team.id == team_id))).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="team not found")

    captain = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user.id,
                TeamMember.role == TeamMemberRole.CAPTAIN,
            )
        )
    ).scalar_one_or_none()
    if not captain:
        raise HTTPException(status_code=403, detail="only captain can view requests")

    requests = (
        await db.execute(
            select(TeamJoinRequest)
            .where(TeamJoinRequest.team_id == team_id, TeamJoinRequest.status == JoinRequestStatus.PENDING)
            .options(selectinload(TeamJoinRequest.user))
            .order_by(TeamJoinRequest.created_at.desc())
        )
    ).scalars().all()
    return [_join_request_out(r) for r in requests]


@router.post("/{team_id}/requests/{request_id}/decide", response_model=JoinRequestOut)
async def decide_join_request(
    team_id: int,
    request_id: int,
    payload: JoinRequestDecision,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JoinRequestOut:
    team = (await db.execute(select(Team).where(Team.id == team_id))).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="team not found")

    captain = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user.id,
                TeamMember.role == TeamMemberRole.CAPTAIN,
            )
        )
    ).scalar_one_or_none()
    if not captain:
        raise HTTPException(status_code=403, detail="only captain can approve/reject requests")

    request = (
        await db.execute(
            select(TeamJoinRequest)
            .where(TeamJoinRequest.id == request_id, TeamJoinRequest.team_id == team_id)
            .options(selectinload(TeamJoinRequest.user))
        )
    ).scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="request not found")
    if request.status != JoinRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="request already decided")

    hack = (await db.execute(select(Hackathon).where(Hackathon.id == team.hackathon_id))).scalar_one()
    members = (await db.execute(select(TeamMember).where(TeamMember.team_id == team.id))).scalars().all()

    if payload.decision == "approved":
        if len(members) >= hack.max_team_size:
            raise HTTPException(status_code=400, detail="team is full")
        if await _check_user_in_hackathon(db, request.user_id, team.hackathon_id):
            raise HTTPException(status_code=400, detail="user already in another team for this hackathon")

        request.status = JoinRequestStatus.APPROVED
        request.decided_at = datetime.now(timezone.utc)
        db.add(TeamMember(team_id=team.id, user_id=request.user_id, role=TeamMemberRole.MEMBER))
        notify(
            db,
            request.user_id,
            "Заявка одобрена",
            f"Вас приняли в команду «{team.name}».",
            NotificationType.JOIN_DECISION,
        )
    else:
        request.status = JoinRequestStatus.REJECTED
        request.decided_at = datetime.now(timezone.utc)
        notify(
            db,
            request.user_id,
            "Заявка отклонена",
            f"Капитан отклонил вашу заявку в команду «{team.name}».",
            NotificationType.JOIN_DECISION,
        )

    await db.commit()
    await db.refresh(request, attribute_names=["user"])
    return _join_request_out(request)


@router.get("/{team_id}", response_model=TeamOut)
async def get_team(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TeamOut:
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="team not found")
    return _team_out(team)


@router.patch("/{team_id}", response_model=TeamOut)
async def update_team(
    team_id: int,
    payload: TeamUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TeamOut:
    team = (await db.execute(select(Team).where(Team.id == team_id))).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="team not found")

    captain = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user.id,
                TeamMember.role == TeamMemberRole.CAPTAIN,
            )
        )
    ).scalar_one_or_none()
    if not captain:
        raise HTTPException(status_code=403, detail="only captain can edit team")

    if payload.name is not None:
        existing = (
            await db.execute(
                select(Team).where(
                    Team.hackathon_id == team.hackathon_id,
                    Team.name == payload.name,
                    Team.id != team_id,
                )
            )
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="team name already exists in this hackathon")
        team.name = payload.name

    if payload.notes is not None:
        team.notes = payload.notes

    await db.commit()
    team = (
        await db.execute(
            select(Team).where(Team.id == team.id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one()
    return _team_out(team)


@router.post("/{team_id}/decision", response_model=TeamOut)
async def decide_team(
    team_id: int,
    payload: TeamDecision,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_organizer),
) -> TeamOut:
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="team not found")
    hack = (await db.execute(select(Hackathon).where(Hackathon.id == team.hackathon_id))).scalar_one()
    if hack.organizer_id != user.id:
        raise HTTPException(status_code=403, detail="not your hackathon")
    team.status = TeamStatus(payload.decision)
    team.decided_at = datetime.now(timezone.utc)
    member_ids = [m.user_id for m in (team.members or [])]
    if payload.decision == "approved":
        notify_many(
            db,
            member_ids,
            "Команда одобрена",
            f"Команду «{team.name}» допустили к участию в «{hack.title}».",
            NotificationType.TEAM_DECISION,
        )
    elif payload.decision == "rejected":
        notify_many(
            db,
            member_ids,
            "Команда отклонена",
            f"Заявку команды «{team.name}» на «{hack.title}» отклонили.",
            NotificationType.TEAM_DECISION,
        )
    await db.commit()
    team = (
        await db.execute(
            select(Team).where(Team.id == team.id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one()
    return _team_out(team)


@router.delete("/{team_id}", status_code=204)
async def delete_team(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Delete a team. Allowed for its captain or the hackathon's organizer."""
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.members))
        )
    ).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="team not found")

    hack = (await db.execute(select(Hackathon).where(Hackathon.id == team.hackathon_id))).scalar_one()
    is_captain = any(
        m.user_id == user.id and m.role == TeamMemberRole.CAPTAIN for m in (team.members or [])
    )
    is_organizer = user.role == UserRole.ORGANIZER and hack.organizer_id == user.id
    if not (is_captain or is_organizer):
        raise HTTPException(status_code=403, detail="only captain or organizer can delete the team")

    team_name = team.name
    recipients = [m.user_id for m in (team.members or []) if m.user_id != user.id]
    notify_many(
        db,
        recipients,
        "Команда удалена",
        f"Команда «{team_name}» была расформирована.",
        NotificationType.TEAM_REMOVED,
    )
    await db.delete(team)
    await db.commit()


@router.delete("/{team_id}/members/{member_user_id}", response_model=TeamOut)
async def remove_member(
    team_id: int,
    member_user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TeamOut:
    """Remove a member from a team. Captain (not self) or hackathon organizer."""
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="team not found")

    hack = (await db.execute(select(Hackathon).where(Hackathon.id == team.hackathon_id))).scalar_one()
    is_captain = any(
        m.user_id == user.id and m.role == TeamMemberRole.CAPTAIN for m in (team.members or [])
    )
    is_organizer = user.role == UserRole.ORGANIZER and hack.organizer_id == user.id
    if not (is_captain or is_organizer):
        raise HTTPException(status_code=403, detail="only captain or organizer can remove members")

    target = next((m for m in (team.members or []) if m.user_id == member_user_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="member not found")
    if target.role == TeamMemberRole.CAPTAIN:
        raise HTTPException(status_code=400, detail="captain cannot be removed; delete the team instead")

    await db.delete(target)
    notify(
        db,
        member_user_id,
        "Вас исключили из команды",
        f"Вас удалили из команды «{team.name}».",
        NotificationType.KICKED,
    )
    await db.commit()
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one()
    return _team_out(team)


async def _assert_can_submit(db: AsyncSession, team_id: int, user: User) -> tuple[Team, Hackathon]:
    """Common guard for artifact submission: member + approved + before deadline."""
    team = (await db.execute(select(Team).where(Team.id == team_id))).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="team not found")
    is_member = (
        await db.execute(
            select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == user.id)
        )
    ).scalar_one_or_none()
    if not is_member:
        raise HTTPException(status_code=403, detail="not a team member")
    hack = (await db.execute(select(Hackathon).where(Hackathon.id == team.hackathon_id))).scalar_one()
    if team.status != TeamStatus.APPROVED:
        raise HTTPException(status_code=400, detail="team not approved")
    now = datetime.now(timezone.utc)
    # Uploads are allowed only while the hackathon is ongoing (registration is not).
    if now < hack.start_date:
        raise HTTPException(status_code=400, detail="hackathon has not started yet")
    if now > hack.submission_deadline:
        raise HTTPException(status_code=400, detail="submission deadline passed")
    return team, hack


async def _ensure_submission(db: AsyncSession, team_id: int) -> tuple[Submission, bool]:
    """Return (submission, created). `created` is True on first submission."""
    sub = (
        await db.execute(select(Submission).where(Submission.team_id == team_id))
    ).scalar_one_or_none()
    if not sub:
        sub = Submission(team_id=team_id)
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
        return sub, True
    return sub, False


@router.put("/{team_id}/submission", response_model=TeamOut)
async def update_submission(
    team_id: int,
    payload: SubmissionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TeamOut:
    team, _hack = await _assert_can_submit(db, team_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(team, field, value)
    # A team uses EITHER a Git URL OR an uploaded archive — providing a repo URL
    # drops any previously uploaded archive so there is a single code source.
    if team.github_url:
        archive = _archive_path(team_id)
        if archive.exists():
            archive.unlink()
    # Same rule for documentation: a link drops a previously uploaded doc file.
    if team.docs_url:
        doc = _doc_file_path(team_id)
        if doc:
            doc.unlink()
    # Same rule for the presentation: a link drops a previously uploaded file.
    if team.presentation_url:
        pres = _presentation_file_path(team_id)
        if pres:
            pres.unlink()
    # Same rule for the screencast: a link drops a previously uploaded video.
    if team.video_url:
        vid = _video_file_path(team_id)
        if vid:
            vid.unlink()
    await db.commit()
    sub, created = await _ensure_submission(db, team_id)
    # Re-run only the checks whose artifact was provided (all on first submission).
    only: set[str] | None
    if created:
        only = None
    else:
        data = payload.model_dump(exclude_unset=True)
        only = set()
        if data.get("github_url"):
            only.add("code")
        if data.get("docs_url"):
            only.add("docs")
        if data.get("presentation_url"):
            only.add("presentation")
        if data.get("video_url"):
            only.add("video")
    from app.workers.dispatcher import dispatch_checks

    if only is None or only:
        await dispatch_checks(team_id, sub.id, only)
    team = (
        await db.execute(
            select(Team).where(Team.id == team.id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one()
    return _team_out(team)


@router.post("/{team_id}/submission/archive", response_model=TeamOut)
async def upload_archive(
    team_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TeamOut:
    """Upload a project archive (.zip) instead of (or in addition to) a Git URL.

    The archive is stored under the uploads volume and the code check runs
    against it. Only zip files are accepted; the content is never executed.
    """
    team, _hack = await _assert_can_submit(db, team_id, user)

    name = (file.filename or "").lower()
    if not name.endswith(".zip"):
        raise HTTPException(status_code=400, detail="only .zip archives are accepted")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(status_code=400, detail=f"archive exceeds {settings.max_upload_mb} MB")
    if data[:4] != b"PK\x03\x04":
        raise HTTPException(status_code=400, detail="file is not a valid zip archive")

    team_dir = Path(settings.upload_dir) / f"team_{team_id}"
    team_dir.mkdir(parents=True, exist_ok=True)
    (team_dir / "code.zip").write_bytes(data)

    # Using an archive ⇒ drop the Git URL so there is a single code source.
    team.github_url = None
    await db.commit()

    sub, created = await _ensure_submission(db, team_id)
    from app.workers.dispatcher import dispatch_checks

    # only re-run the code check (all checks on first submission)
    await dispatch_checks(team_id, sub.id, None if created else {"code"})
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one()
    return _team_out(team)


@router.delete("/{team_id}/submission/archive", response_model=TeamOut)
async def delete_archive(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TeamOut:
    """Remove the uploaded archive so the team can switch back to a Git URL."""
    team, _hack = await _assert_can_submit(db, team_id, user)
    archive = _archive_path(team_id)
    if archive.exists():
        archive.unlink()
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one()
    return _team_out(team)


@router.post("/{team_id}/submission/docs", response_model=TeamOut)
async def upload_docs(
    team_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TeamOut:
    """Upload a documentation file (PDF / DOCX / Markdown) instead of a URL."""
    team, _hack = await _assert_can_submit(db, team_id, user)

    name = (file.filename or "").lower()
    ext = next((e for e in DOC_EXTS if name.endswith(e)), None)
    if ext is None:
        raise HTTPException(status_code=400, detail="only .pdf, .docx or .md files are accepted")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(status_code=400, detail=f"file exceeds {settings.max_upload_mb} MB")
    # light magic-byte validation
    if ext == ".pdf" and not data.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="file is not a valid PDF")
    if ext == ".docx" and data[:4] != b"PK\x03\x04":
        raise HTTPException(status_code=400, detail="file is not a valid DOCX")

    team_dir = Path(settings.upload_dir) / f"team_{team_id}"
    team_dir.mkdir(parents=True, exist_ok=True)
    # remove any previous doc file (different extension) then write the new one
    existing = _doc_file_path(team_id)
    if existing:
        existing.unlink()
    (team_dir / f"docs{ext}").write_bytes(data)

    # using an uploaded doc ⇒ drop the docs URL (single source)
    team.docs_url = None
    await db.commit()

    sub, created = await _ensure_submission(db, team_id)
    from app.workers.dispatcher import dispatch_checks

    # only re-run the documentation check (all checks on first submission)
    await dispatch_checks(team_id, sub.id, None if created else {"docs"})
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one()
    return _team_out(team)


@router.delete("/{team_id}/submission/docs", response_model=TeamOut)
async def delete_docs(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TeamOut:
    """Remove the uploaded documentation file so the team can use a URL again."""
    team, _hack = await _assert_can_submit(db, team_id, user)
    doc = _doc_file_path(team_id)
    if doc:
        doc.unlink()
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one()
    return _team_out(team)


@router.post("/{team_id}/submission/presentation", response_model=TeamOut)
async def upload_presentation(
    team_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TeamOut:
    """Upload a presentation file (PPTX / PDF) instead of a URL."""
    team, _hack = await _assert_can_submit(db, team_id, user)

    name = (file.filename or "").lower()
    ext = next((e for e in PRES_EXTS if name.endswith(e)), None)
    if ext is None:
        raise HTTPException(status_code=400, detail="only .pptx or .pdf files are accepted")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(status_code=400, detail=f"file exceeds {settings.max_upload_mb} MB")
    # light magic-byte validation (PDF: %PDF, PPTX: zip container PK\x03\x04)
    if ext == ".pdf" and not data.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="file is not a valid PDF")
    if ext == ".pptx" and data[:4] != b"PK\x03\x04":
        raise HTTPException(status_code=400, detail="file is not a valid PPTX")

    team_dir = Path(settings.upload_dir) / f"team_{team_id}"
    team_dir.mkdir(parents=True, exist_ok=True)
    # remove any previous presentation file (different extension) then write new
    existing = _presentation_file_path(team_id)
    if existing:
        existing.unlink()
    (team_dir / f"presentation{ext}").write_bytes(data)

    # using an uploaded file ⇒ drop the presentation URL (single source)
    team.presentation_url = None
    await db.commit()

    sub, created = await _ensure_submission(db, team_id)
    from app.workers.dispatcher import dispatch_checks

    # only re-run the presentation check (all checks on first submission)
    await dispatch_checks(team_id, sub.id, None if created else {"presentation"})
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one()
    return _team_out(team)


@router.delete("/{team_id}/submission/presentation", response_model=TeamOut)
async def delete_presentation(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TeamOut:
    """Remove the uploaded presentation file so the team can use a URL again."""
    team, _hack = await _assert_can_submit(db, team_id, user)
    pres = _presentation_file_path(team_id)
    if pres:
        pres.unlink()
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one()
    return _team_out(team)


@router.post("/{team_id}/submission/video", response_model=TeamOut)
async def upload_video(
    team_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TeamOut:
    """Upload a screencast video file (MP4 / MOV / WEBM / MKV / AVI) instead of a URL."""
    team, _hack = await _assert_can_submit(db, team_id, user)

    name = (file.filename or "").lower()
    ext = next((e for e in VIDEO_EXTS if name.endswith(e)), None)
    if ext is None:
        raise HTTPException(status_code=400, detail="only .mp4, .mov, .webm, .mkv or .avi files are accepted")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(status_code=400, detail=f"file exceeds {settings.max_upload_mb} MB")

    team_dir = Path(settings.upload_dir) / f"team_{team_id}"
    team_dir.mkdir(parents=True, exist_ok=True)
    # remove any previous video file (different extension) then write the new one
    existing = _video_file_path(team_id)
    if existing:
        existing.unlink()
    (team_dir / f"video{ext}").write_bytes(data)

    # using an uploaded file ⇒ drop the video URL (single source)
    team.video_url = None
    await db.commit()

    sub, created = await _ensure_submission(db, team_id)
    from app.workers.dispatcher import dispatch_checks

    # only re-run the video check (all checks on first submission)
    await dispatch_checks(team_id, sub.id, None if created else {"video"})
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one()
    return _team_out(team)


@router.delete("/{team_id}/submission/video", response_model=TeamOut)
async def delete_video(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TeamOut:
    """Remove the uploaded video file so the team can use a URL again."""
    team, _hack = await _assert_can_submit(db, team_id, user)
    vid = _video_file_path(team_id)
    if vid:
        vid.unlink()
    team = (
        await db.execute(
            select(Team).where(Team.id == team_id).options(selectinload(Team.members).selectinload(TeamMember.user))
        )
    ).scalar_one()
    return _team_out(team)
