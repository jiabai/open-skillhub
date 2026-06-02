from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from loguru import logger

from backend.config.settings import settings
from backend.core.middleware.logging import safe_log_context

from ._exceptions import error_payload


def register_request_size_middleware(application: FastAPI) -> None:
    @application.middleware("http")
    async def limit_skill_download_request_size(request: Request, call_next):
        if request.method == "POST" and request.url.path == "/api/v1/client/skills/download":
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    if int(content_length) > settings.SKILL_DOWNLOAD_MAX_REQUEST_BYTES:
                        logger.bind(
                            **safe_log_context(
                                path=request.url.path,
                                content_length=content_length,
                                limit_bytes=settings.SKILL_DOWNLOAD_MAX_REQUEST_BYTES,
                            )
                        ).debug("Client skill download request rejected because Content-Length is too large")
                        return JSONResponse(
                            status_code=413,
                            content=error_payload("Request too large", "REQUEST_TOO_LARGE"),
                        )
                except ValueError:
                    logger.bind(path=request.url.path, content_length=content_length).debug(
                        "Client skill download request rejected because Content-Length is invalid"
                    )
                    return JSONResponse(
                        status_code=400,
                        content=error_payload("Invalid Content-Length header", "BAD_REQUEST"),
                    )
            received_bytes = 0
            original_receive = request._receive

            async def limited_receive():
                nonlocal received_bytes
                message = await original_receive()
                if message["type"] == "http.request":
                    body = message.get("body", b"")
                    received_bytes += len(body)
                    if received_bytes > settings.SKILL_DOWNLOAD_MAX_REQUEST_BYTES:
                        logger.bind(
                            **safe_log_context(
                                path=request.url.path,
                                received_bytes=received_bytes,
                                limit_bytes=settings.SKILL_DOWNLOAD_MAX_REQUEST_BYTES,
                            )
                        ).debug("Client skill download request stream exceeded size limit")
                        raise HTTPException(
                            status_code=413,
                            detail={"detail": "Request too large", "code": "REQUEST_TOO_LARGE"},
                        )
                return message

            request._receive = limited_receive
        return await call_next(request)
