import asyncio
from collections import defaultdict
from pathlib import Path

from skillhub.config.settings import settings

_slot_lock = asyncio.Lock()
_user_running: dict[str, int] = defaultdict(int)
_team_running: dict[str, int] = defaultdict(int)


def _safe_limit(value: int, fallback: int = 1) -> int:
    if value <= 0:
        return fallback
    return value


async def acquire_execution_slot(user_id: str, team_id: str | None):
    user_limit = _safe_limit(settings.SKILL_MAX_CONCURRENT_EXECUTIONS_PER_USER)
    team_limit = _safe_limit(settings.SKILL_MAX_CONCURRENT_EXECUTIONS_PER_TEAM)
    async with _slot_lock:
        if _user_running[user_id] >= user_limit:
            return None
        if team_id and _team_running[team_id] >= team_limit:
            return None
        _user_running[user_id] += 1
        if team_id:
            _team_running[team_id] += 1

    async def _release():
        async with _slot_lock:
            if _user_running[user_id] > 0:
                _user_running[user_id] -= 1
            if _user_running[user_id] <= 0:
                _user_running.pop(user_id, None)
            if team_id:
                if _team_running[team_id] > 0:
                    _team_running[team_id] -= 1
                if _team_running[team_id] <= 0:
                    _team_running.pop(team_id, None)

    return _release


def _dir_size_bytes(path: Path) -> int:
    total = 0
    for item in path.rglob("*"):
        if item.is_file():
            try:
                total += item.stat().st_size
            except OSError:
                continue
    return total


def is_within_workdir_quota(path: Path, max_bytes: int | None = None) -> bool:
    if not path.exists():
        return True
    limit = max_bytes if max_bytes is not None else settings.SKILL_MAX_WORKDIR_BYTES
    if limit <= 0:
        return True
    return _dir_size_bytes(path) <= limit


def truncate_output(output: str, max_bytes: int | None = None) -> str:
    limit = max_bytes if max_bytes is not None else settings.SKILL_MAX_OUTPUT_BYTES
    if limit <= 0:
        return output
    encoded = output.encode("utf-8")
    if len(encoded) <= limit:
        return output
    return encoded[:limit].decode("utf-8", errors="ignore")
