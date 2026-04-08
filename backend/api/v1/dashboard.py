from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from backend.config.settings import settings
from backend.core.deps import require_management_access, require_permission
from backend.core.permissions import Permission
from backend.db.session import get_async_session
from backend.repositories.request_metric import RequestMetricRepository
from backend.repositories.skill import SkillRepository
from backend.repositories.token import TokenRepository
from backend.schemas.metrics import MetricsCleanupRequest, MetricsCleanupResponse
from backend.schemas.metrics_reset import MetricsReset24hResponse
from backend.schemas.response import DashboardOverviewResponse


router = APIRouter()


@router.get("/overview", response_model=DashboardOverviewResponse)
async def get_dashboard_overview(
    current_user=Depends(require_permission(Permission.DASHBOARD_READ)),
    session=Depends(get_async_session),
):
    skill_repo = SkillRepository(session)
    token_repo = TokenRepository(session)
    metric_repo = RequestMetricRepository(session)
    active_skills = await skill_repo.count_active_by_user(current_user.id)
    available_tokens = await token_repo.count_available_by_user(current_user.id, datetime.now(timezone.utc))
    window_end = datetime.now(timezone.utc)
    window_start = window_end - timedelta(hours=24)
    total, success = await metric_repo.aggregate_window(str(current_user.id), window_start, window_end)
    success_rate = 0 if total == 0 else success / total * 100
    return DashboardOverviewResponse(
        active_skills=active_skills,
        available_tokens=available_tokens,
        success_rate=success_rate,
        success_rate_window_hours=24,
        success_rate_total=total,
    )


@router.post("/metrics/cleanup", response_model=MetricsCleanupResponse)
async def cleanup_metrics(
    payload: MetricsCleanupRequest | None = None,
    current_user=Depends(require_management_access()),
    session=Depends(get_async_session),
):
    retention_days = (
        payload.retention_days
        if payload and payload.retention_days is not None
        else settings.METRICS_RETENTION_DAYS
    )
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=retention_days)
    metric_repo = RequestMetricRepository(session)
    removed = await metric_repo.cleanup_before(cutoff)
    cutoff_text = cutoff.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return MetricsCleanupResponse(
        removed=removed,
        retention_days=retention_days,
        cutoff=cutoff_text,
    )


@router.post("/metrics/reset-24h", response_model=MetricsReset24hResponse)
async def reset_metrics_24h(
    current_user=Depends(require_management_access()),
    session=Depends(get_async_session),
):
    window_end = datetime.now(timezone.utc)
    window_start = window_end - timedelta(hours=24)
    metric_repo = RequestMetricRepository(session)
    removed = await metric_repo.delete_window(str(current_user.id), window_start, window_end)
    window_start_text = window_start.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    window_end_text = window_end.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return MetricsReset24hResponse(
        removed=removed,
        window_hours=24,
        window_start=window_start_text,
        window_end=window_end_text,
    )
