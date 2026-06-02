from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger

from backend.core.errors import error_payload as build_error_payload
from backend.core.errors import (
    error_payload_from_exception as build_error_payload_from_exception,
)
from backend.core.middleware.logging import safe_log_context


def error_payload(detail: object, code: str) -> dict:
    return build_error_payload(detail, code)


def error_payload_from_exception(detail: object, status_code: int) -> dict:
    return build_error_payload_from_exception(detail, status_code)


def _request_context(
    request: Request, *, status_code: int | None = None, code: str | None = None
) -> dict:
    return safe_log_context(
        method=request.method,
        path=request.url.path,
        status_code=status_code,
        code=code,
        client=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", ""),
        request_id=request.headers.get("x-request-id", "")
        or request.headers.get("x-correlation-id", ""),
    )


def register_exception_handlers(application: FastAPI) -> None:
    @application.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        payload = error_payload_from_exception(exc.detail, exc.status_code)
        logger.bind(
            **_request_context(
                request,
                status_code=exc.status_code,
                code=str(payload.get("code") or ""),
            )
        ).debug("HTTP exception handled")
        return JSONResponse(
            status_code=exc.status_code,
            content=payload,
        )

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ):
        logger.bind(
            **_request_context(request, status_code=422, code="VALIDATION_ERROR"),
            validation_error_count=len(exc.errors()),
        ).debug("Request validation failed")
        return JSONResponse(
            status_code=422,
            content=error_payload("Validation error", "VALIDATION_ERROR"),
        )

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, _exc: Exception):
        logger.bind(
            **_request_context(request, status_code=500, code="INTERNAL_SERVER_ERROR")
        ).exception("Unhandled request exception")
        return JSONResponse(
            status_code=500,
            content=error_payload("Internal Server Error", "INTERNAL_SERVER_ERROR"),
        )
