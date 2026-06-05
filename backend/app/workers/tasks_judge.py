
from app.core.celery_app import celery_app
from app.services.judge import judge_submission
from app.workers.db import session_scope

VERDICT_PRIORITY = {
    "OK": 0,
    "WA": 1,
    "RE": 2,
    "CE": 3,
    "TL": 4,
    "ML": 5,
}

def _worse(a: str, b: str) -> str:
    return a if VERDICT_PRIORITY.get(a, 99) >= VERDICT_PRIORITY.get(b, 99) else b

@celery_app.task(name="app.workers.tasks_judge.judge_submission_task", bind=True, max_retries=1)
def judge_submission_task(self, algorithm_submission_id: int) -> dict:
    with session_scope() as db:
        from app.models.algorithm import (
            AlgorithmSubmission,
            AlgorithmSubmissionTest,
            AlgorithmTask,
            AlgorithmTest,
            Verdict,
        )

        sub = db.get(AlgorithmSubmission, algorithm_submission_id)
        if not sub:
            return {"ok": False, "error": "submission not found"}
        task = db.get(AlgorithmTask, sub.task_id)
        if not task:
            return {"ok": False, "error": "task not found"}

        sub.verdict = Verdict.RUNNING
        db.commit()

        tests = db.query(AlgorithmTest).filter(AlgorithmTest.task_id == task.id).all()
        tests_payload = [{"input_data": t.input_data, "expected_output": t.expected_output} for t in tests]
        results = judge_submission(
            code=sub.code,
            language=sub.language.value,
            tests=tests_payload,
            time_limit_ms=task.time_limit_ms,
            memory_limit_mb=task.memory_limit_mb,
        )

        sub_results = (
            db.query(AlgorithmSubmissionTest)
            .filter(AlgorithmSubmissionTest.submission_id == sub.id)
            .all()
        )
        overall = "OK"
        max_runtime = 0
        max_mem = 0.0
        for r, sr, t in zip(results, sub_results, tests):
            sr.verdict = Verdict(r["verdict"])
            sr.runtime_ms = int(r["runtime_ms"])
            sr.memory_mb = float(r["memory_mb"])
            sr.output = (r["output"] or "")[:4000]
            sr.log = (r["log"] or "")[:4000]
            overall = _worse(overall, r["verdict"])
            max_runtime = max(max_runtime, sr.runtime_ms)
            max_mem = max(max_mem, sr.memory_mb)

        sub.verdict = Verdict(overall)
        sub.runtime_ms = max_runtime
        sub.memory_mb = max_mem
        db.commit()
    return {"ok": True, "submission_id": algorithm_submission_id, "verdict": overall}
