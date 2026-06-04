from fastapi import APIRouter

from app.api.v1 import (
    algorithm,
    auth,
    dashboard,
    hackathons,
    jury,
    notifications,
    organizer,
    results,
    teams,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(hackathons.router, prefix="/hackathons", tags=["hackathons"])
api_router.include_router(teams.router, prefix="/teams", tags=["teams"])
api_router.include_router(jury.router, prefix="/jury", tags=["jury"])
api_router.include_router(organizer.router, prefix="/organizer", tags=["organizer"])
api_router.include_router(results.router, prefix="/results", tags=["results"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(algorithm.router, prefix="/algorithm", tags=["algorithm"])
