"""Backward-compatible shim for legacy imports.

User status is a domain concern and now lives in ``backend.domain.user_status``.
"""

from backend.domain.user_status import (
    ALLOWED_USER_STATUSES,
    DEFAULT_USER_STATUS,
    USER_STATUS_LABELS,
    USER_STATUS_VALUES,
    UserStatus,
    assert_user_active,
    is_user_active,
    normalize_user_status,
    user_status_is_active,
)

__all__ = [
    "ALLOWED_USER_STATUSES",
    "DEFAULT_USER_STATUS",
    "USER_STATUS_LABELS",
    "USER_STATUS_VALUES",
    "UserStatus",
    "assert_user_active",
    "is_user_active",
    "normalize_user_status",
    "user_status_is_active",
]
