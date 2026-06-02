from fastapi import Request
from loguru import logger

from backend.config.settings import settings
from backend.core.middleware.logging import safe_log_context
from backend.repositories.audit_log import AuditLogRepository
from backend.services.audit import AuditService


async def create_audit_event(
    session,
    request: Request | None,
    current_user,
    action: str,
    target: str,
    metadata: dict | None = None,
) -> None:
    if not settings.ENABLE_AUDIT_LOG:
        logger.bind(**safe_log_context(action=action, target=target)).debug("Audit event skipped because audit is disabled")
        return
    audit_service = AuditService(AuditLogRepository(session))
    await audit_service.create_event(
        actor_id=current_user.id,
        action=action,
        target=target,
        ip=request.client.host if request and request.client else "",
        user_agent=request.headers.get("user-agent", "") if request else "",
        metadata=metadata,
    )
