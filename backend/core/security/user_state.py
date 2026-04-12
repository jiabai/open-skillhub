from __future__ import annotations

import json
from pathlib import Path
from enum import StrEnum

from fastapi import HTTPException
from starlette import status


_USER_STATUS_CATALOG = json.loads(
    Path(__file__).resolve().parents[3].joinpath("shared", "user-statuses.json").read_text(encoding="utf-8")
)

DEFAULT_USER_STATUS = _USER_STATUS_CATALOG["default"]
USER_STATUS_VALUES = tuple(_USER_STATUS_CATALOG["statuses"])
ALLOWED_USER_STATUSES = frozenset(USER_STATUS_VALUES)
UserStatus = StrEnum("UserStatus", {value.upper(): value for value in USER_STATUS_VALUES})


def normalize_user_status(value: object, default: str = DEFAULT_USER_STATUS) -> str:
    normalized = str(value or default).strip().lower()
    if normalized not in ALLOWED_USER_STATUSES:
        raise ValueError("Invalid user status")
    return normalized


def user_status_is_active(status_value: object) -> bool:
    return normalize_user_status(status_value) == DEFAULT_USER_STATUS


def is_user_active(user) -> bool:
    return bool(getattr(user, "is_active", False)) and user_status_is_active(getattr(user, "status", DEFAULT_USER_STATUS))


def assert_user_active(user) -> None:
    if not is_user_active(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
