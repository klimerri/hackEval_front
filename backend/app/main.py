from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import settings
from app.core.redis_client import close_redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_redis()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="HackAuth: automatic evaluation service for hackathon teams.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok", "service": settings.app_name, "env": settings.app_env}


@app.get("/", tags=["health"])
async def root() -> dict:
    return {
        "service": settings.app_name,
        "version": app.version,
        "docs": "/docs",
        "api": "/api/v1",
    }
