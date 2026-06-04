# HackAuth backend

FastAPI + SQLAlchemy 2 (async) + PostgreSQL + Redis + Celery.

- регистрация / авторизация (JWT, bcrypt, роли)
  - саморегистрация создаёт только участника; роли жюри назначает организатор
- каталог хакатонов, команд, заявок (вступление по заявке, исключение, удаление)
- уведомления (заявки, решения, изменения статуса)
- загрузка артефактов и автоматическая проверка
  - код (README / LICENSE / deps / LOC / cyclomatic complexity / secrets)
  - документация (PDF / DOCX / Markdown)
  - презентация (PDF / PPTX, слайды и обязательные разделы)
  - видео (ffprobe: длительность, разрешение, кодек)
- оценка жюри (design / pitch / complexity + комментарий) с коэффициентами
- итоговый рейтинг с учётом весов
- алгоритмический модуль: задачи, тесты, отправки, вердикты OK / WA / TL /
  ML / RE / CE, песочница с rlimit CPU/AS
- Docker Compose: `db`, `redis`, `api`, `worker`

## Запуск

```
cd backend
cp .env.example .env
docker compose up --build
```

API: `http://localhost:8000` (docs at `/docs`).
Smoke test:

```
docker compose exec api python -m scripts.smoke
```

## Архитектура

```
backend/
  app/
    main.py
    api/v1/         # REST: auth, hackathons, teams, jury, organizer, results, algorithm, dashboard
    core/           # config, db (async), redis, celery, security, deps
    models/         # SQLAlchemy 2 models
    schemas/        # Pydantic v2
    services/       # code_check, doc_check, presentation_check, video_check, judge, scoring
    workers/        # Celery tasks (checks + judge) + dispatcher
  alembic/          # миграции
  scripts/          # seed, smoke
  Dockerfile
  docker-compose.yml
  requirements.txt
```

## Endpoints (v1)

| Метод | URL | Назначение |
| --- | --- | --- |
| POST | `/auth/register` | регистрация (всегда роль `participant`) |
| POST | `/auth/login` | вход |
| GET | `/auth/me` | профиль |
| GET | `/dashboard` | статистика по роли + хакатоны + анонсы |
| GET | `/notifications` | список уведомлений + счётчик непрочитанных |
| POST | `/notifications/{id}/read` | отметить прочитанным |
| POST | `/notifications/read-all` | отметить все прочитанными |
| GET | `/hackathons` | каталог |
| GET | `/hackathons/{id}` | карточка |
| POST | `/hackathons` | создать (организатор) |
| PATCH | `/hackathons/{id}` | обновить (организатор) |
| GET | `/hackathons/{id}/invite` | invite link |
| GET | `/teams` | мои команды |
| GET | `/teams/explore` | открытые команды |
| POST | `/teams` | создать команду + заявка (участник) |
| POST | `/teams/manual` | создать одобренную команду (организатор) |
| PATCH | `/teams/{id}` | редактировать название/заметки (капитан) |
| DELETE | `/teams/{id}` | удалить команду (капитан/организатор) |
| POST | `/teams/{id}/join` | подать заявку на вступление (участник) |
| GET | `/teams/{id}/requests` | заявки на вступление (капитан) |
| POST | `/teams/{id}/requests/{rid}/decide` | одобрить/отклонить заявку (капитан) |
| DELETE | `/teams/{id}/members/{uid}` | исключить участника (капитан/организатор) |
| GET | `/teams/{id}` | карточка |
| POST | `/teams/{id}/decision` | одобрить/отклонить команду (организатор) |
| PUT | `/teams/{id}/submission` | обновить ссылки на артефакты |
| GET | `/jury/hackathons` | хакатоны для оценки |
| GET | `/jury/hackathons/{id}/teams` | команды для оценки + сводка автопроверок |
| PUT | `/jury/teams/{id}/score` | сохранить оценку |
| GET | `/organizer/jury-pool` | пул жюри |
| GET | `/organizer/teams` | все команды по хакатонам организатора |
| GET | `/organizer/hackathons/{id}/jury` | назначенные жюри хакатона |
| POST | `/organizer/hackathons/{id}/jury` | назначить жюри |
| DELETE | `/organizer/hackathons/{id}/jury/{uid}` | снять жюри |
| POST | `/organizer/jury/promote` | повысить участника до жюри по email |
| POST | `/organizer/jury` | создать новый аккаунт жюри |
| GET | `/organizer/analytics` | аналитика |
| GET | `/results/me` | мои результаты |
| GET | `/results/hackathons/{id}/ranking` | таблица |
| GET | `/results/hackathons/{id}/winners` | top 3 |
| POST | `/results/submissions/{id}/rerun` | перезапустить проверки |
| GET | `/algorithm/tasks` | список задач |
| POST | `/algorithm/tasks` | создать задачу (организатор) |
| GET | `/algorithm/tasks/{id}` | карточка |
| POST | `/algorithm/submissions` | отправить решение |
| GET | `/algorithm/submissions/{id}` | статус |
| GET | `/algorithm/submissions/mine` | история попыток |

## Безопасность

- bcrypt (`passlib`)
- JWT (HS256), 24 ч
- роли: `participant`, `jury`, `organizer`; проверка в `app/core/deps.py`
- изоляция пользовательского кода: subprocess + `RLIMIT_CPU` + `RLIMIT_AS`
- rate-limiting готов к подключению через Redis (см. `app/core/redis_client.py`)

## Без Docker

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
export POSTGRES_HOST=localhost
export REDIS_HOST=localhost
alembic upgrade head
uvicorn app.main:app --reload
celery -A app.core.celery_app.celery_app worker -Q default,checks,judge -l info
```
