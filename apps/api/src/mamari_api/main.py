from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from mamari_api.api.v1.router import api_router
from mamari_api.core.config import get_settings

settings = get_settings()

api_app = FastAPI(
    title="Mamari API",
    description="API REST de la plateforme de gestion d'entreprise Mamari.",
    version="0.1.0",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url="/redoc" if settings.app_env != "production" else None,
    openapi_url="/openapi.json" if settings.app_env != "production" else None,
)

@api_app.middleware("http")
async def reject_untrusted_origins(request: Request, call_next):
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        if origin is not None and origin not in settings.cors_origins:
            return JSONResponse(
                status_code=403,
                content={"detail": "Origine de requête non autorisée."},
            )
    return await call_next(request)


@api_app.exception_handler(RequestValidationError)
async def sanitized_validation_error(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    errors = [
        {
            "loc": error["loc"],
            "msg": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})


api_app.include_router(api_router, prefix="/api/v1")

app = CORSMiddleware(
    app=api_app,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Organization-ID"],
)
