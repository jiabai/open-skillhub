import asyncio
import time

from fastapi import HTTPException, Request, status
from loguru import logger

from backend.config.settings import settings
from backend.core.middleware.logging import safe_log_context
from backend.schemas.skill_download import SkillDownloadRequest, SkillDownloadResponse
from backend.services.skill import DownloadTooLargeError

from .audit import create_audit_event
from .error_mapper import handle_skill_value_error
from .service_factory import build_skill_service


_DOWNLOAD_RATE_LIMIT_CLEANUP_INTERVAL_SECONDS = 60
_download_rate_limit_lock = asyncio.Lock()
_download_rate_limit_state: dict[str, list[float]] = {}
_download_rate_limit_last_cleanup = 0.0


def _cleanup_download_rate_limit_state(now: float, window: int) -> None:
    global _download_rate_limit_last_cleanup
    cleanup_interval = min(window, _DOWNLOAD_RATE_LIMIT_CLEANUP_INTERVAL_SECONDS)
    if now - _download_rate_limit_last_cleanup < cleanup_interval:
        return
    cutoff = now - window
    stale_keys: list[str] = []
    for key, timestamps in _download_rate_limit_state.items():
        recent = [timestamp for timestamp in timestamps if timestamp >= cutoff]
        if recent:
            _download_rate_limit_state[key] = recent
        else:
            stale_keys.append(key)
    for key in stale_keys:
        _download_rate_limit_state.pop(key, None)
    _download_rate_limit_last_cleanup = now


async def enforce_download_rate_limit(request: Request, current_user) -> None:
    if not settings.ENABLE_RATE_LIMIT:
        return
    limit = settings.SKILL_DOWNLOAD_RATE_LIMIT_REQUESTS
    window = settings.SKILL_DOWNLOAD_RATE_LIMIT_WINDOW
    if limit <= 0 or window <= 0:
        return
    key = str(getattr(current_user, "id", "") or (request.client.host if request and request.client else "unknown"))
    now = time.monotonic()
    async with _download_rate_limit_lock:
        _cleanup_download_rate_limit_state(now, window)
        timestamps = _download_rate_limit_state.get(key, [])
        cutoff = now - window
        timestamps = [timestamp for timestamp in timestamps if timestamp >= cutoff]
        if len(timestamps) >= limit:
            logger.bind(
                **safe_log_context(
                    user_id=str(getattr(current_user, "id", "")),
                    request_count=len(timestamps),
                    limit=limit,
                    window_seconds=window,
                )
            ).debug("Skill download rate limit exceeded")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "detail": "Too many download requests. Please try again later.",
                    "code": "RATE_LIMIT_EXCEEDED",
                },
            )
        timestamps.append(now)
        _download_rate_limit_state[key] = timestamps


async def handle_skill_download_request(
    request: Request,
    payload: SkillDownloadRequest,
    current_user,
    session,
) -> SkillDownloadResponse:
    service = build_skill_service(session)
    try:
        logger.bind(
            **safe_log_context(
                user_id=str(getattr(current_user, "id", "")),
                skill_uuid=payload.skill_uuid,
                requested_version=payload.version or "(current)",
            )
        ).debug("Skill download request started")
        await enforce_download_rate_limit(request, current_user)
        result = await service.download_skill(current_user, payload.skill_uuid, payload.version)
    except DownloadTooLargeError as exc:
        logger.bind(
            **safe_log_context(
                user_id=str(getattr(current_user, "id", "")),
                skill_uuid=payload.skill_uuid,
                requested_version=payload.version or "(current)",
                size_bytes=exc.size_bytes,
                limit_bytes=exc.limit_bytes,
            )
        ).debug("Skill download rejected because archive is too large")
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Download too large ({exc.size_bytes // 1024 // 1024}MB). Max allowed is {exc.limit_bytes // 1024 // 1024}MB.",
        ) from exc
    except ValueError as exc:
        logger.bind(
            **safe_log_context(
                user_id=str(getattr(current_user, "id", "")),
                skill_uuid=payload.skill_uuid,
                requested_version=payload.version or "(current)",
                reason=str(exc),
            )
        ).debug("Skill download rejected")
        raise handle_skill_value_error(exc) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.bind(
            **safe_log_context(
                user_id=str(getattr(current_user, "id", "")),
                skill_uuid=payload.skill_uuid,
                requested_version=payload.version or "(current)",
                reason=str(exc),
            )
        ).exception("Skill download failed unexpectedly")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Download failed") from exc

    response_payload = SkillDownloadResponse.model_validate(result)
    logger.bind(
        **safe_log_context(
            user_id=str(getattr(current_user, "id", "")),
            skill_uuid=payload.skill_uuid,
            requested_version=payload.version or "(current)",
            resolved_version=response_payload.version,
            archive_size_bytes=response_payload.archive_size_bytes,
            encryption_enabled=response_payload.encryption_enabled,
        )
    ).debug("Skill download payload built")
    await create_audit_event(
        session,
        request,
        current_user,
        "skill.download",
        payload.skill_uuid,
        metadata={
            "version": response_payload.version,
            "requested_version": payload.version or "(current)",
            "archive_size_bytes": response_payload.archive_size_bytes,
            "encryption_enabled": response_payload.encryption_enabled,
            "download_filename": response_payload.download_filename,
        },
    )
    return response_payload
