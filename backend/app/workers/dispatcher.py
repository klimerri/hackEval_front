import asyncio
import logging

from app.core.celery_app import celery_app
from app.workers.tasks_code import check_code_task
from app.workers.tasks_docs import check_docs_task
from app.workers.tasks_judge import judge_submission_task
from app.workers.tasks_presentation import check_presentation_task
from app.workers.tasks_video import check_video_task

logger = logging.getLogger(__name__)


async def dispatch_checks(team_id: int, submission_id: int) -> None:
    check_code_task.delay(submission_id)
    check_docs_task.delay(submission_id)
    check_presentation_task.delay(submission_id)
    check_video_task.delay(submission_id)
    logger.info("dispatched checks for submission=%s", submission_id)


def dispatch_judge(submission_id: int) -> None:
    judge_submission_task.delay(submission_id)
    logger.info("dispatched judge for submission=%s", submission_id)
