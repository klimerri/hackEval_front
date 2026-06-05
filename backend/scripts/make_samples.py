"""Generate two sample project archives for testing the code check:

    python -m scripts.make_samples

Creates `scripts/samples/good.zip` and `scripts/samples/bad.zip`.

- good.zip  — README с инструкцией запуска, LICENSE, requirements, чистый код,
              без секретов → высокий балл.
- bad.zip   — нет README/LICENSE/зависимостей, запутанный код (много замечаний
              линтера и высокая сложность), захардкоженные «секреты» → низкий балл.

Затем проверить:
    python -m scripts.check_repo scripts/samples/good.zip
    python -m scripts.check_repo scripts/samples/bad.zip
"""
from __future__ import annotations

import zipfile
from pathlib import Path

SAMPLES = Path(__file__).resolve().parent / "samples"

GOOD_README = """# Task Tracker

Небольшой сервис учёта задач.

## Описание работы системы
Хранит задачи в памяти и считает статистику.

## Установка
```
pip install -r requirements.txt
```

## Запуск
```
python -m src.app
```
"""

GOOD_LICENSE = """MIT License

Copyright (c) 2026 Demo Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files, to deal in the Software
without restriction.
"""

GOOD_APP = '''"""Task tracker core."""
from dataclasses import dataclass, field

@dataclass
class Task:
    title: str
    done: bool = False

@dataclass
class Tracker:
    tasks: list[Task] = field(default_factory=list)

    def add(self, title: str) -> Task:
        task = Task(title=title)
        self.tasks.append(task)
        return task

    def complete(self, index: int) -> None:
        self.tasks[index].done = True

    def pending(self) -> list[Task]:
        return [t for t in self.tasks if not t.done]

def main() -> None:
    tracker = Tracker()
    tracker.add("write docs")
    tracker.add("ship mvp")
    tracker.complete(0)
    print(f"pending: {len(tracker.pending())}")

if __name__ == "__main__":
    main()
'''

GOOD_TEST = '''from src.app import Tracker

def test_pending():
    t = Tracker()
    t.add("a")
    t.add("b")
    t.complete(0)
    assert len(t.pending()) == 1
'''

_FAKE_SECRETS = (
    'AWS_KEY = "' + "AKIA" + 'IOSFODNN7EXAMPLE"\n'
    'API_KEY = "' + "api_key = " + '1234567890abcdef1234"\n'
    'password = "' + "super" + 'secret123"'
)

BAD_MAIN = '''import os
import sys
import json
import re

''' + _FAKE_SECRETS + '''

def f(a,b,c,d,e):
    x=0
    if a>0:
        if b>0:
            if c>0:
                if d>0:
                    if e>0:
                        x=a+b+c+d+e
                    else:
                        x=a
                else:
                    x=b
            else:
                x=c
        else:
            x=d
    else:
        x=e
    return x

def g( y ):
    unused = 123
    result=[]
    for i in range(y):
        for j in range(y):
            result.append(i*j)
    return result

print(f(1,2,3,4,5))
'''

_PARA = (
    "Система предназначена для автоматического учёта и оценки решений команд. "
    "Она принимает артефакты, выполняет проверки и формирует итоговый рейтинг. "
)

GOOD_DOCS = (
    "# Документация проекта Task Tracker\n\n"
    "## Описание работы системы\n\n"
    + _PARA * 20
    + "\n\n![Архитектура](architecture.png)\n\n"
    "## Инструкция по развёртыванию\n\n"
    + _PARA * 20
    + "\n\n```\ndocker compose up --build\n```\n\n"
    "## Инструкция по эксплуатации\n\n"
    + _PARA * 20
    + "\n\n![Схема экранов](screens.png)\n"
)

BAD_DOCS = "# Заметки\n\nПроект почти готов. Допишем позже.\n"

def _write_zip(path: Path, files: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, content in files.items():
            z.writestr(name, content)

def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

def main() -> None:
    _write_zip(
        SAMPLES / "good.zip",
        {
            "task-tracker/README.md": GOOD_README,
            "task-tracker/LICENSE": GOOD_LICENSE,
            "task-tracker/requirements.txt": "pytest\n",
            "task-tracker/src/__init__.py": "",
            "task-tracker/src/app.py": GOOD_APP,
            "task-tracker/tests/test_app.py": GOOD_TEST,
        },
    )
    _write_zip(
        SAMPLES / "bad.zip",
        {
            "messy/main.py": BAD_MAIN,
            "messy/notes.txt": "todo: clean up later",
        },
    )
    _write_text(SAMPLES / "good_docs.md", GOOD_DOCS)
    _write_text(SAMPLES / "bad_docs.md", BAD_DOCS)
    print(
        "created:\n"
        f"  {SAMPLES / 'good.zip'}\n  {SAMPLES / 'bad.zip'}\n"
        f"  {SAMPLES / 'good_docs.md'}\n  {SAMPLES / 'bad_docs.md'}"
    )

if __name__ == "__main__":
    main()
