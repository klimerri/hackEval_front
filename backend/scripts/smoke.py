"""End-to-end smoke test using httpx against a running API.

Usage (with the stack already up via docker compose):

    docker compose exec api python -m scripts.smoke

Prints PASS/FAIL per step and exits 1 on any failure.
"""
from __future__ import annotations

import asyncio
import os
import sys

import httpx

BASE = os.getenv("SMOKE_BASE", "http://localhost:8000")
EMAIL = os.getenv("SMOKE_EMAIL", "smoke@hackauth.com")
PASSWORD = os.getenv("SMOKE_PASSWORD", "smokepass123")


def _ok(label: str, cond: bool, extra: str = "") -> None:
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {label}{(' — ' + extra) if extra else ''}")
    if not cond:
        sys.exit(1)


async def main() -> None:
    async with httpx.AsyncClient(base_url=BASE, timeout=30.0) as c:
        r = await c.get("/health")
        _ok("health", r.status_code == 200 and r.json().get("status") == "ok", str(r.status_code))

        r = await c.post(
            "/api/v1/auth/register",
            json={"name": "Smoke", "email": EMAIL, "password": PASSWORD, "role": "organizer"},
        )
        if r.status_code == 400 and "already" in r.text:
            r = await c.post(
                "/api/v1/auth/login",
                json={"email": EMAIL, "password": PASSWORD},
            )
        _ok("auth", r.status_code == 200, str(r.status_code))
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        r = await c.get("/api/v1/auth/me", headers=headers)
        _ok("me", r.status_code == 200 and r.json()["email"] == EMAIL, str(r.status_code))

        r = await c.get("/api/v1/hackathons", headers=headers)
        _ok("hackathons list", r.status_code == 200 and isinstance(r.json(), list), str(r.status_code))
        if not r.json():
            print("[INFO] no hackathons yet — seed may not have run")
            return

        hid = r.json()[0]["id"]

        r = await c.get(f"/api/v1/hackathons/{hid}", headers=headers)
        _ok("hackathon get", r.status_code == 200, str(r.status_code))

        r = await c.get("/api/v1/dashboard", headers=headers)
        _ok("dashboard", r.status_code == 200, str(r.status_code))

        r = await c.get(f"/api/v1/results/hackathons/{hid}/ranking", headers=headers)
        _ok("ranking", r.status_code == 200, str(r.status_code))

        r = await c.get("/api/v1/jury/hackathons", headers=headers)
        _ok("jury hackathons", r.status_code == 200, str(r.status_code))

        r = await c.get(f"/api/v1/jury/hackathons/{hid}/teams", headers=headers)
        _ok("jury teams", r.status_code == 200, str(r.status_code))

        r = await c.get("/api/v1/algorithm/tasks", headers=headers, params={"hackathon_id": hid})
        _ok("algorithm tasks", r.status_code == 200, str(r.status_code))

        if r.json():
            task_id = r.json()[0]["id"]
            code = (
                "import sys\n"
                "def solve():\n"
                "    d = sys.stdin.read().strip().split()\n"
                "    print(int(d[0]) + int(d[1]))\n"
                "solve()\n"
            )
            r = await c.post(
                "/api/v1/algorithm/submissions",
                headers=headers,
                json={"task_id": task_id, "code": code, "language": "python"},
            )
            _ok("algorithm submit", r.status_code == 201, str(r.status_code))
            sub_id = r.json()["id"]
            await asyncio.sleep(2.0)
            r = await c.get(f"/api/v1/algorithm/submissions/{sub_id}", headers=headers)
            _ok(
                "algorithm verdict",
                r.status_code == 200 and r.json()["verdict"] in ("OK", "WA", "RE", "CE", "TL", "ML"),
                r.json().get("verdict", "?"),
            )

        print("ALL OK")


if __name__ == "__main__":
    asyncio.run(main())
