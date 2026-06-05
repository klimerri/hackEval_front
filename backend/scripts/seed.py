"""Seed the database with demo data that matches the frontend mockups.

Run inside the api container:
    python -m scripts.seed
"""
from __future__ import annotations

import asyncio
import os
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.algorithm import AlgorithmLanguage, AlgorithmSubmission, AlgorithmTask, AlgorithmTest, Verdict
from app.models.hackathon import Hackathon, HackathonStatus
from app.models.jury import JuryAssignment, JuryScore
from app.models.submission import (
    CodeCheck,
    DocCheck,
    PresentationCheck,
    Submission,
    SubmissionStatus,
    VideoCheck,
)
from app.models.team import Team, TeamMember, TeamMemberRole, TeamStatus
from app.models.user import User, UserRole

HACKATHONS = [
    {
        "title": "AI Innovation Hack 2026",
        "description": "Создание инновационных решений на базе генеративного ИИ для бизнеса.",
        "date_offset_days": -2,
        "duration_days": 7,
        "prize_pool": "500 000 ₽",
        "image": "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800",
        "type": "Online",
        "tags": ["AI", "Python", "LLM"],
    },
    {
        "title": "Web3 Future Challenge",
        "description": "Разработка децентрализованных приложений на базе блокчейна Ethereum.",
        "date_offset_days": 25,
        "duration_days": 3,
        "prize_pool": "300 000 ₽",
        "image": "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=800",
        "type": "Hybrid",
        "tags": ["Web3", "Solidity", "DApp"],
    },
    {
        "title": "EcoTech Green Code",
        "description": "Хакатон по разработке IT-решений для улучшения экологии городов.",
        "date_offset_days": 40,
        "duration_days": 3,
        "prize_pool": "1 000 000 ₽",
        "image": "https://images.unsplash.com/photo-1542601906990-b4d3fb773b09?auto=format&fit=crop&q=80&w=800",
        "type": "Offline",
        "tags": ["IoT", "Data Science", "Green"],
    },
    {
        "title": "CyberSecurity Defense",
        "description": "Соревнования по поиску уязвимостей и защите информационных систем.",
        "date_offset_days": 55,
        "duration_days": 3,
        "prize_pool": "400 000 ₽",
        "image": "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800",
        "type": "Online",
        "tags": ["Security", "Linux", "Network"],
    },
]

DEMO_PASSWORD = os.environ.get("SEED_PASSWORD", "password")

async def get_or_create_user(db: AsyncSession, name: str, email: str, role: UserRole, password: str = DEMO_PASSWORD) -> User:
    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    if user:
        return user
    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        role=role,
    )
    db.add(user)
    await db.flush()
    return user

async def main() -> None:
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        organizer = await get_or_create_user(db, "Organizer Admin", "organizer@hackauth.com", UserRole.ORGANIZER)
        jury1 = await get_or_create_user(db, "John Doe", "john@jury.com", UserRole.JURY)
        jury1.company = "Google"
        jury1.specialization = "Backend"
        jury2 = await get_or_create_user(db, "Jane Smith", "jane@jury.com", UserRole.JURY)
        jury2.company = "Figma"
        jury2.specialization = "Design"
        jury3 = await get_or_create_user(db, "Alex Kuznetsov", "alex@jury.com", UserRole.JURY)
        jury3.company = "Yandex"
        jury3.specialization = "ML"
        reviewer = await get_or_create_user(db, "Maria Reviewer", "reviewer@jury.com", UserRole.JURY)
        reviewer.company = "Sber"
        reviewer.specialization = "QA / Review"

        captain = await get_or_create_user(db, "Alex K.", "alex@team.com", UserRole.PARTICIPANT)
        captain2 = await get_or_create_user(db, "Sarah J.", "sarah@team.com", UserRole.PARTICIPANT)
        captain3 = await get_or_create_user(db, "Mike R.", "mike@team.com", UserRole.PARTICIPANT)
        await db.flush()
        await db.commit()

        first_hack = (await db.execute(select(Hackathon).order_by(Hackathon.id))).scalars().first()
        if first_hack:
            if "2024" in (first_hack.title or ""):
                first_hack.title = first_hack.title.replace("2024", "2026")
            now_ts = datetime.now(timezone.utc)
            first_hack.start_date = now_ts - timedelta(days=2)
            first_hack.end_date = now_ts + timedelta(days=5)
            first_hack.submission_deadline = now_ts + timedelta(days=5) - timedelta(hours=2)
            first_hack.status = HackathonStatus.ACTIVE
            assigned = (
                await db.execute(
                    select(JuryAssignment).where(
                        JuryAssignment.hackathon_id == first_hack.id,
                        JuryAssignment.user_id == reviewer.id,
                    )
                )
            ).scalar_one_or_none()
            if not assigned:
                db.add(JuryAssignment(hackathon_id=first_hack.id, user_id=reviewer.id))
            await db.commit()

        existing_h = (await db.execute(select(Hackathon).where(Hackathon.title == HACKATHONS[0]["title"]))).scalar_one_or_none()
        if existing_h:
            print("seed: already seeded, skipping")
            return

        created_hackathons: list[Hackathon] = []
        for h in HACKATHONS:
            start = now + timedelta(days=h["date_offset_days"])
            end = start + timedelta(days=h["duration_days"])
            deadline = end - timedelta(hours=2)
            hack = Hackathon(
                title=h["title"],
                description=h["description"],
                rules=[
                    "Команда от 2 до 5 человек",
                    "Использование OpenSource библиотек разрешено",
                    "Код должен быть размещен на GitHub",
                    "Презентация не более 10 слайдов",
                ],
                start_date=start,
                end_date=end,
                submission_deadline=deadline,
                status=HackathonStatus.ACTIVE,
                prize_pool=h["prize_pool"],
                image_url=h["image"],
                type=h["type"],
                coefficients={"code": 40, "design": 30, "pitch": 30},
                max_team_size=5,
                organizer_id=organizer.id,
            )
            db.add(hack)
            await db.flush()
            created_hackathons.append(hack)

        for hack in created_hackathons[:1]:
            for j in (jury1, jury2, jury3, reviewer):
                db.add(JuryAssignment(hackathon_id=hack.id, user_id=j.id))

        team_specs = [
            ("Neural Knights", 0, captain, TeamStatus.APPROVED, True),
            ("Data Wizards", 0, captain2, TeamStatus.APPROVED, True),
            ("AI Rebels", 0, captain3, TeamStatus.APPROVED, True),
            ("Cloud Miners", 0, None, TeamStatus.PENDING, False),
            ("Pending Squad", 1, None, TeamStatus.PENDING, False),
        ]
        teams: list[Team] = []
        for name, idx, owner, status, with_artifacts in team_specs:
            t = Team(
                name=name,
                hackathon_id=created_hackathons[idx].id,
                status=status,
                invite_code=secrets.token_urlsafe(8),
                notes="",
            )
            if with_artifacts:
                t.github_url = "https://github.com/octocat/Hello-World"
                t.docs_url = "https://www.africau.edu/images/default/sample.pdf"
                t.presentation_url = "https://www.africau.edu/images/default/sample.pdf"
                t.video_url = "https://download.samplelib.com/mp4/sample-5s.mp4"
            db.add(t)
            await db.flush()
            if owner is not None:
                db.add(TeamMember(team_id=t.id, user_id=owner.id, role=TeamMemberRole.CAPTAIN))
            teams.append(t)

        for t in teams[:3]:
            sub = Submission(team_id=t.id, status=SubmissionStatus.EVALUATED)
            db.add(sub)
            await db.flush()
            db.add(
                CodeCheck(
                    submission_id=sub.id,
                    status="done",
                    score=8.5,
                    has_readme=True,
                    has_license=True,
                    has_deps_file=True,
                    has_run_instructions=True,
                    loc=420,
                    avg_complexity=3.2,
                    secrets_found=0,
                    message="ok",
                    finished_at=now,
                )
            )
            db.add(
                DocCheck(
                    submission_id=sub.id,
                    status="done",
                    score=8.0,
                    word_count=1500,
                    has_description=True,
                    has_deploy=True,
                    has_usage=True,
                    image_count=4,
                    fmt="pdf",
                    message="ok",
                    finished_at=now,
                )
            )
            db.add(
                PresentationCheck(
                    submission_id=sub.id,
                    status="done",
                    score=9.0,
                    slide_count=10,
                    sections_found=["problem", "solution", "audience", "stack", "demo", "team", "contacts"],
                    fmt="pdf",
                    message="ok",
                    finished_at=now,
                )
            )
            db.add(
                VideoCheck(
                    submission_id=sub.id,
                    status="done",
                    score=8.0,
                    duration_sec=240,
                    width=1920,
                    height=1080,
                    codec="h264",
                    transcription="",
                    summary="",
                    message="ok",
                    finished_at=now,
                )
            )
            sub.auto_score = round(8.5 * 0.4 + 8.0 * 0.25 + 9.0 * 0.2 + 8.0 * 0.15, 2)

        jury_scores = [
            (teams[0], jury1, 9, 8, 9, "Отличная архитектура и RAG-система."),
            (teams[1], jury1, 6, 7, 5, "Хорошо, но мало тестов."),
            (teams[2], jury1, 7, 8, 7, "Стабильный MVP."),
            (teams[0], jury2, 8, 9, 7, "Дизайн аккуратный."),
            (teams[1], jury2, 7, 6, 6, "Дизайн базовый."),
            (teams[2], jury2, 9, 8, 8, "Продуманный UX."),
        ]
        for team, j, d, p, c, comment in jury_scores:
            db.add(
                JuryScore(
                    team_id=team.id,
                    jury_id=j.id,
                    scores={"design": d, "pitch": p, "complexity": c},
                    design=d,
                    pitch=p,
                    complexity=c,
                    comment=comment,
                )
            )

        from app.services.scoring import combine_scores, jury_value_for

        for t in teams[:3]:
            sub = (await db.execute(select(Submission).where(Submission.team_id == t.id))).scalar_one()
            scores = (await db.execute(select(JuryScore).where(JuryScore.team_id == t.id))).scalars().all()
            hack = (await db.execute(select(Hackathon).where(Hackathon.id == t.hackathon_id))).scalar_one()
            criteria = hack.jury_criteria or []
            jury_avg = (
                sum(jury_value_for(s, criteria) for s in scores) / len(scores) if scores else 0.0
            )
            sub.final_score = combine_scores(sub.auto_score, jury_avg)

        algo_task = AlgorithmTask(
            hackathon_id=created_hackathons[0].id,
            title="Сумма двух чисел",
            statement="Даны два целых числа a и b. Выведите их сумму.\n\nВходные данные: два числа в одной строке.\nВыходные данные: одно число — сумма.",
            time_limit_ms=2000,
            memory_limit_mb=64,
            language=AlgorithmLanguage.PYTHON,
        )
        db.add(algo_task)
        await db.flush()
        for inp, out, sample in [
            ("1 2\n", "3\n", True),
            ("10 20\n", "30\n", True),
            ("0 0\n", "0\n", False),
            ("-5 5\n", "0\n", False),
            ("1000000 1000000\n", "2000000\n", False),
        ]:
            db.add(AlgorithmTest(task_id=algo_task.id, input_data=inp, expected_output=out, sample=sample))

        sample_code = (
            "import sys\n"
            "def solve():\n"
            "    data = sys.stdin.read().strip().split()\n"
            "    if not data:\n"
            "        return\n"
            "    a, b = int(data[0]), int(data[1])\n"
            "    print(a + b)\n"
            "solve()\n"
        )
        db.add(
            AlgorithmSubmission(
                task_id=algo_task.id,
                user_id=captain.id,
                code=sample_code,
                language=AlgorithmLanguage.PYTHON,
                verdict=Verdict.OK,
                runtime_ms=15,
                memory_mb=8.4,
                log="seeded sample submission",
            )
        )

        await db.commit()
        print("seed: done")

if __name__ == "__main__":
    asyncio.run(main())
