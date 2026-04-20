from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from backend.core.errors import error_payload as build_error_payload
from backend.core.errors import error_payload_from_exception as build_error_payload_from_exception


def error_payload(detail: object, code: str) -> dict:
    return build_error_payload(detail, code)


def error_payload_from_exception(detail: object, status_code: int) -> dict:
    return build_error_payload_from_exception(detail, status_code)


def register_exception_handlers(application: FastAPI) -> None:
    @application.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload_from_exception(exc.detail, exc.status_code),
        )

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(_request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content=error_payload("Validation error", "VALIDATION_ERROR"),
        )

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, _exc: Exception):
        return JSONResponse(
            status_code=500,
            content=error_payload("Internal Server Error", "INTERNAL_SERVER_ERROR"),
        )
