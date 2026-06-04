#!/usr/bin/env python
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.workers.tasks_code import check_code_task
from app.workers.tasks_docs import check_docs_task
from app.workers.tasks_judge import judge_submission_task
from app.workers.tasks_presentation import check_presentation_task
from app.workers.tasks_video import check_video_task
