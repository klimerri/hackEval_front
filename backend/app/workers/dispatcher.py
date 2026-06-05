import logging

from app.workers.tasks_code import check_code_task
from app.workers.tasks_docs import check_docs_task
from app.workers.tasks_judge import judge_submission_task
from app.workers.tasks_presentation import check_presentation_task
from app.workers.tasks_video import check_video_task

logger = logging.getLogger(__name__)


CHECK_TASKS = {
    "code": check_code_task,
    "docs": check_docs_task,
    "presentation": check_presentation_task,
    "video": check_video_task,
}


async def dispatch_checks(
    team_id: int, submission_id: int, only: set[str] | None = None
) -> None:
    """Enqueue auto-checks. `only` limits which checks run (e.g. {"docs"}).

    When None, all four checks run (used on the first submission so every check
    row exists for finalisation).
    """
    targets = set(CHECK_TASKS) if only is None else (set(only) & set(CHECK_TASKS))
    for name in targets:
        CHECK_TASKS[name].delay(submission_id)
    logger.info("dispatched checks %s for submission=%s", sorted(targets), submission_id)


def dispatch_judge(submission_id: int) -> None:
    judge_submission_task.delay(submission_id)
    logger.info("dispatched judge for submission=%s", submission_id)
