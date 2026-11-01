from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from mamari_api.api.v1.router import api_router
from mamari_api.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Mamari API",
    description="API REST de la plateforme de gestion d'entreprise Mamari.",
    version="0.1.0",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url="/redoc" if settings.app_env != "production" else None,
    openapi_url="/openapi.json" if settings.app_env != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(api_router, prefix="/api/v1")
