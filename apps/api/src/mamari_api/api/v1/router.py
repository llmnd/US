from fastapi import APIRouter

from mamari_api.modules.health.router import router as health_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
