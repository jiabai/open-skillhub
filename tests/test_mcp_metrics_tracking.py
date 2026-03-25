from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

from backend.config.settings import settings
from backend.core.metrics.tool_call_metrics import (
    record_tool_call,
    reset_session_provider,
    set_session_provider,
)
from backend.core.utils.skill_storage import tool_error_payload
from backend.core.utils.user_context import set_current_user_id
from backend.models.request_metric import RequestMetric
from backend.repositories.user import UserRepository


@pytest.mark.asyncio
async def test_tool_call_metrics_use_hour_bucket_counts(async_session):
    user_repo = UserRepository(async_session)
    user = await user_repo.create(email="tool-metric@example.com", username="toolmetric", password="pass1234")

    async def session_provider():
        yield async_session

    set_session_provider(session_provider)
    set_current_user_id(str(user.id))
    try:
        await record_tool_call("load_skill", output="ok")
        await record_tool_call("load_skill", output=tool_error_payload("bad", "ANY_ERROR"))
    finally:
        set_current_user_id(None)
        reset_session_provider()

    bucket_start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    row = await async_session.execute(
        select(RequestMetric).where(RequestMetric.user_id == user.id, RequestMetric.bucket_start == bucket_start)
    )
    metric = row.scalar_one()
    assert metric.total_count == 2
    assert metric.success_count == 1
    assert metric.failure_count == 1

    result = await async_session.execute(
        select(func.coalesce(func.sum(RequestMetric.total_count), 0)).where(RequestMetric.user_id == user.id)
    )
    assert int(result.scalar_one()) == 2


@pytest.mark.asyncio
async def test_tool_call_metrics_disabled_by_enable_metrics(async_session):
    user_repo = UserRepository(async_session)
    user = await user_repo.create(email="tool-metric-off@example.com", username="toolmetricoff", password="pass1234")

    async def session_provider():
        yield async_session

    original_enable = settings.ENABLE_METRICS
    settings.ENABLE_METRICS = False
    set_session_provider(session_provider)
    set_current_user_id(str(user.id))
    try:
        await record_tool_call("load_skill", output="ok")
    finally:
        settings.ENABLE_METRICS = original_enable
        set_current_user_id(None)
        reset_session_provider()

    result = await async_session.execute(
        select(func.coalesce(func.sum(RequestMetric.total_count), 0)).where(RequestMetric.user_id == user.id)
    )
    assert int(result.scalar_one()) == 0
