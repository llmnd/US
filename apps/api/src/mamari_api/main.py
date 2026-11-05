from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.types import Receive, Scope, Send

from mamari_api.api.v1.router import api_router
from mamari_api.core.config import get_settings

settings = get_settings()


class VercelFastAPI(FastAPI):
    def __init__(self, *, cors_origins: list[str], **kwargs) -> None:
        super().__init__(**kwargs)
        self._cors_app = CORSMiddleware(
            app=self._call_fastapi,
            allow_origins=cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=["Content-Type", "X-Organization-ID"],
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        await self._cors_app(scope, receive, send)

    async def _call_fastapi(self, scope: Scope, receive: Receive, send: Send) -> None:
        await super().__call__(scope, receive, send)


api_app = VercelFastAPI(
    title="Oulimata API",
    description="API REST de la boutique en ligne Oulimata.",
    version="0.1.0",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url="/redoc" if settings.app_env != "production" else None,
    openapi_url="/openapi.json" if settings.app_env != "production" else None,
    cors_origins=settings.cors_origins,
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

app = api_app
