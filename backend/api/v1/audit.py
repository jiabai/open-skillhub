from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from backend.config.settings import settings
from backend.core.deps import require_management_access
from backend.db.session import get_async_session
from backend.repositories.audit_log import AuditLogRepository
from backend.schemas.audit import AuditLogExportRequest, AuditLogExportResponse, AuditLogListResponse
from backend.services.audit import AuditService


router = APIRouter()


def _parse_time(value: str | None, field_name: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid time format for '{field_name}'",
        ) from exc


@router.get("/logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    actor_id: str | None = None,
    action: str | None = None,
    start: str | None = None,
    end: str | None = None,
    skip: int = 0,
    limit: int = 100,
    current_user=Depends(require_management_access()),
    session=Depends(get_async_session),
):
    if not settings.ENABLE_AUDIT_LOG:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Audit disabled")
    service = AuditService(AuditLogRepository(session))
    items = await service.list_events(
        actor_id=actor_id,
        action=action,
        start=_parse_time(start, "start"),
        end=_parse_time(end, "end"),
        skip=skip,
        limit=limit,
    )
    return AuditLogListResponse(items=items)


@router.post("/logs/export", response_model=AuditLogExportResponse)
async def export_audit_logs(
    payload: AuditLogExportRequest,
    current_user=Depends(require_management_access()),
    session=Depends(get_async_session),
):
    if not settings.ENABLE_AUDIT_EXPORT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Audit export disabled")
    filters = payload.filters or {}
    service = AuditService(AuditLogRepository(session))
    items = await service.list_events(
        actor_id=filters.get("actor_id"),
        action=filters.get("action"),
        start=_parse_time(filters.get("start"), "start"),
        end=_parse_time(filters.get("end"), "end"),
        skip=0,
        limit=1000,
    )
    normalized = [
        {
            "id": item.id,
            "actor_id": item.actor_id,
            "action": item.action,
            "target": item.target,
            "result": item.result,
            "timestamp": item.timestamp.isoformat().replace("+00:00", "Z"),
            "ip": item.ip,
            "user_agent": item.user_agent,
            "details": item.details,
        }
        for item in items
    ]
    fmt = payload.format.lower()
    if fmt == "csv":
        content = service.export_csv(normalized)
    else:
        content = service.export_json(normalized)
        fmt = "json"
    if settings.ENABLE_AUDIT_LOG:
        await service.create_event(
            actor_id=current_user.id,
            action="audit.export",
            target="audit.logs",
            metadata={"format": fmt, "count": len(normalized)},
        )
    return AuditLogExportResponse(format=fmt, content=content)
