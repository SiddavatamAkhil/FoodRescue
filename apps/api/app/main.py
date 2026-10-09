
import time
import uuid

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.db.session import engine
from app.api import (
    auth,
    organizations,
    donations,
    demands,
    matching,
    claims,
    pickups,
    notifications,
    admin,
    analytics,
    ai,
)

app = FastAPI(
    title="FoodRescue API",
    description=(
        "AI-Powered Food Surplus Redistribution & "
        "Rescue Platform Backend (Andhra Pradesh, India)"
    ),
    version="1.0.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
    redoc_url="/api/v1/redoc",
)

# --------------------------------------------------
# CORS configuration
# --------------------------------------------------

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# Request ID and processing-time middleware
# --------------------------------------------------

@app.middleware("http")
async def add_request_id_and_process_time(
    request: Request,
    call_next,
):
    request_id = (
        request.headers.get("X-Request-ID")
        or str(uuid.uuid4())
    )

    request.state.request_id = request_id
    start_time = time.time()

    response = await call_next(request)

    process_time = time.time() - start_time

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = str(process_time)

    return response


# --------------------------------------------------
# Generic exception handler
# --------------------------------------------------

@app.exception_handler(Exception)
async def generic_exception_handler(
    request: Request,
    exc: Exception,
):
    request_id = getattr(
        request.state,
        "request_id",
        "unknown",
    )

    # Keep internal exception details out of client responses.
    # Configure server-side logging separately for diagnosis.
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": (
                    "An unexpected error occurred. "
                    "Please contact support."
                ),
                "request_id": request_id,
            }
        },
    )


# --------------------------------------------------
# Health check
# --------------------------------------------------

@app.get(
    "/health",
    status_code=status.HTTP_200_OK,
    tags=["health"],
)
async def health_check():
    return {
        "status": "healthy",
        "timestamp": time.time(),
    }


# --------------------------------------------------
# Database readiness check
# --------------------------------------------------

@app.get(
    "/ready",
    status_code=status.HTTP_200_OK,
    tags=["health"],
)
async def readiness_check():
    try:
        async with engine.connect() as conn:
            # SQLAlchemy 2.x requires text() for raw SQL.
            result = await conn.execute(text("SELECT 1"))
            result.scalar_one()

        return {
            "status": "ready",
            "database": "connected",
            "timestamp": time.time(),
        }

    except SQLAlchemyError:
        # Do not expose database connection details publicly.
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "not_ready",
                "database": "disconnected",
                "message": "Database connectivity check failed.",
                "timestamp": time.time(),
            },
        )

    except Exception:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "not_ready",
                "database": "disconnected",
                "message": "Readiness check failed.",
                "timestamp": time.time(),
            },
        )


# --------------------------------------------------
# API route registration
# --------------------------------------------------

app.include_router(
    auth.router,
    prefix="/api/v1/auth",
    tags=["auth"],
)

app.include_router(
    organizations.router,
    prefix="/api/v1/organizations",
    tags=["organizations"],
)

app.include_router(
    donations.router,
    prefix="/api/v1/donations",
    tags=["donations"],
)

app.include_router(
    demands.router,
    prefix="/api/v1/demands",
    tags=["demands"],
)

app.include_router(
    matching.router,
    prefix="/api/v1/matching",
    tags=["matching"],
)

app.include_router(
    claims.router,
    prefix="/api/v1/claims",
    tags=["claims"],
)

app.include_router(
    pickups.router,
    prefix="/api/v1/pickups",
    tags=["pickups"],
)

app.include_router(
    notifications.router,
    prefix="/api/v1/notifications",
    tags=["notifications"],
)

app.include_router(
    admin.router,
    prefix="/api/v1/admin",
    tags=["admin"],
)

app.include_router(
    analytics.router,
    prefix="/api/v1/analytics",
    tags=["analytics"],
)

app.include_router(
    ai.router,
    prefix="/api/v1/ai",
    tags=["ai"],
)
