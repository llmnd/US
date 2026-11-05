from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str


@router.get("/health", response_model=HealthResponse, summary="Vérifier la disponibilité de l'API")
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok", service="oulumata-api")
