from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "hackauth",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.workers.tasks_code",
        "app.workers.tasks_docs",
        "app.workers.tasks_presentation",
        "app.workers.tasks_video",
        "app.workers.tasks_judge",
    ],
)

celery_app.conf.update(
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_default_queue="default",
    task_routes={
        "app.workers.tasks_code.*": {"queue": "checks"},
        "app.workers.tasks_docs.*": {"queue": "checks"},
        "app.workers.tasks_presentation.*": {"queue": "checks"},
        "app.workers.tasks_video.*": {"queue": "checks"},
        "app.workers.tasks_judge.*": {"queue": "judge"},
    },
    task_time_limit=300,
    task_soft_time_limit=240,
)
