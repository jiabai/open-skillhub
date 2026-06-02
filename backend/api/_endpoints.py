from collections.abc import Awaitable, Callable
from pathlib import Path

import psutil
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from loguru import logger

from backend.config.settings import settings


def _health_content(db_connected: bool) -> dict[str, bool | str]:
    status_value = "healthy" if db_connected else "unhealthy"
    return {"status": status_value, "db_connected": db_connected}


async def _readiness_response(check_db_connection: Callable[[], Awaitable[bool]]) -> JSONResponse:
    db_connected = await check_db_connection()
    status_code = 200 if db_connected else 503
    return JSONResponse(status_code=status_code, content=_health_content(db_connected))


def register_operational_endpoints(
    application: FastAPI,
    check_db_connection: Callable[[], Awaitable[bool]],
) -> None:
    @application.get("/livez")
    async def livez():
        return JSONResponse(status_code=200, content={"status": "alive"})

    @application.get("/readyz")
    async def readyz():
        return await _readiness_response(check_db_connection)

    @application.get("/health")
    async def health():
        return await _readiness_response(check_db_connection)

    @application.get("/metrics")
    async def metrics():
        if not settings.ENABLE_METRICS:
            raise HTTPException(status_code=404, detail="Metrics disabled")
        db_connected = await check_db_connection()
        skill_path = Path(settings.SKILL_STORAGE_PATH)
        disk_root = skill_path if skill_path.exists() else skill_path.parent
        disk_usage_percent = None
        try:
            disk = psutil.disk_usage(str(disk_root))
            disk_usage_percent = disk.percent
        except Exception as exc:
            logger.bind(disk_root=str(disk_root), reason=str(exc)).debug("Metrics disk usage read failed")
            disk_usage_percent = None
        memory = psutil.virtual_memory()
        return {
            "db_connected": db_connected,
            "disk_usage_percent": disk_usage_percent,
            "memory_usage_percent": memory.percent,
            "cpu_usage_percent": psutil.cpu_percent(),
        }
