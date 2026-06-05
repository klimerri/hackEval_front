from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_organizer
from app.models.algorithm import (
    AlgorithmLanguage,
    AlgorithmSubmission,
    AlgorithmSubmissionTest,
    AlgorithmTask,
    AlgorithmTest,
    Verdict,
)
from app.models.hackathon import Hackathon
from app.models.user import User
from app.schemas.algorithm import (
    AlgorithmSubmissionIn,
    AlgorithmSubmissionOut,
    AlgorithmSubmissionTestOut,
    AlgorithmTaskCreate,
    AlgorithmTaskOut,
)

router = APIRouter()


def _task_out(t: AlgorithmTask) -> AlgorithmTaskOut:
    return AlgorithmTaskOut(
        id=t.id,
        hackathon_id=t.hackathon_id,
        title=t.title,
        statement=t.statement,
        time_limit_ms=t.time_limit_ms,
        memory_limit_mb=t.memory_limit_mb,
        language=t.language.value,
        created_at=t.created_at,
        test_count=len(t.tests or []),
    )


@router.get("/tasks", response_model=list[AlgorithmTaskOut])
async def list_tasks(
    hackathon_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AlgorithmTaskOut]:
    q = select(AlgorithmTask).options(selectinload(AlgorithmTask.tests))
    if hackathon_id is not None:
        q = q.where(AlgorithmTask.hackathon_id == hackathon_id)
    rows = (await db.execute(q.order_by(AlgorithmTask.id.desc()))).scalars().all()
    return [_task_out(t) for t in rows]


@router.post("/tasks", response_model=AlgorithmTaskOut, status_code=201)
async def create_task(
    payload: AlgorithmTaskCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_organizer),
) -> AlgorithmTaskOut:
    h = (await db.execute(select(Hackathon).where(Hackathon.id == payload.hackathon_id))).scalar_one_or_none()
    if not h:
        raise HTTPException(status_code=404, detail="hackathon not found")
    task = AlgorithmTask(
        hackathon_id=payload.hackathon_id,
        title=payload.title,
        statement=payload.statement,
        time_limit_ms=payload.time_limit_ms,
        memory_limit_mb=payload.memory_limit_mb,
        language=AlgorithmLanguage(payload.language),
    )
    db.add(task)
    await db.flush()
    for t in payload.tests:
        db.add(AlgorithmTest(task_id=task.id, input_data=t.input_data, expected_output=t.expected_output, sample=t.sample))
    await db.commit()
    task = (
        await db.execute(select(AlgorithmTask).where(AlgorithmTask.id == task.id).options(selectinload(AlgorithmTask.tests)))
    ).scalar_one()
    return _task_out(task)


@router.get("/tasks/{task_id}", response_model=AlgorithmTaskOut)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AlgorithmTaskOut:
    task = (
        await db.execute(
            select(AlgorithmTask).where(AlgorithmTask.id == task_id).options(selectinload(AlgorithmTask.tests))
        )
    ).scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    return _task_out(task)


@router.post("/submissions", response_model=AlgorithmSubmissionOut, status_code=201)
async def submit(
    payload: AlgorithmSubmissionIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AlgorithmSubmissionOut:
    task = (await db.execute(select(AlgorithmTask).where(AlgorithmTask.id == payload.task_id))).scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    sub = AlgorithmSubmission(
        task_id=payload.task_id,
        user_id=user.id,
        code=payload.code,
        language=AlgorithmLanguage(payload.language),
        verdict=Verdict.PENDING,
    )
    db.add(sub)
    await db.flush()
    tests = (await db.execute(select(AlgorithmTest).where(AlgorithmTest.task_id == task.id))).scalars().all()
    for t in tests:
        db.add(AlgorithmSubmissionTest(submission_id=sub.id, test_id=t.id, verdict=Verdict.PENDING))
    await db.commit()
    from app.workers.dispatcher import dispatch_judge
    dispatch_judge(sub.id)
    sub = (
        await db.execute(
            select(AlgorithmSubmission)
            .where(AlgorithmSubmission.id == sub.id)
            .options(selectinload(AlgorithmSubmission.results))
        )
    ).scalar_one()
    return _submission_out(sub)


@router.get("/submissions/{submission_id}", response_model=AlgorithmSubmissionOut)
async def get_submission(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AlgorithmSubmissionOut:
    sub = (
        await db.execute(
            select(AlgorithmSubmission)
            .where(AlgorithmSubmission.id == submission_id)
            .options(selectinload(AlgorithmSubmission.results))
        )
    ).scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="submission not found")
    if sub.user_id != user.id and user.role.value not in ("jury", "organizer"):
        raise HTTPException(status_code=403, detail="forbidden")
    return _submission_out(sub)


@router.get("/submissions/mine", response_model=list[AlgorithmSubmissionOut])
async def my_submissions(
    task_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AlgorithmSubmissionOut]:
    q = (
        select(AlgorithmSubmission)
        .where(AlgorithmSubmission.user_id == user.id)
        .options(selectinload(AlgorithmSubmission.results))
    )
    if task_id is not None:
        q = q.where(AlgorithmSubmission.task_id == task_id)
    q = q.order_by(AlgorithmSubmission.id.desc())
    rows = (await db.execute(q)).scalars().unique().all()
    return [_submission_out(s) for s in rows]


def _submission_out(s: AlgorithmSubmission) -> AlgorithmSubmissionOut:
    return AlgorithmSubmissionOut(
        id=s.id,
        task_id=s.task_id,
        user_id=s.user_id,
        language=s.language.value,
        verdict=s.verdict.value,
        runtime_ms=s.runtime_ms,
        memory_mb=s.memory_mb,
        log=s.log,
        created_at=s.created_at,
        results=[
            AlgorithmSubmissionTestOut(
                id=r.id,
                test_id=r.test_id,
                verdict=r.verdict.value,
                runtime_ms=r.runtime_ms,
                memory_mb=r.memory_mb,
                output=r.output,
                log=r.log,
            )
            for r in (s.results or [])
        ],
    )
