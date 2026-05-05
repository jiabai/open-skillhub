from __future__ import annotations

import json
from datetime import datetime, timezone


class ErrorCode:
    BAD_REQUEST = "BAD_REQUEST"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    RATE_LIMITED = "RATE_LIMITED"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    HTTP_ERROR = "HTTP_ERROR"
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"

    CODE_EXPIRED = "CODE_EXPIRED"
    CODE_INVALID = "CODE_INVALID"
    TOO_MANY_ATTEMPTS = "TOO_MANY_ATTEMPTS"
    RESEND_TOO_FREQUENT = "RESEND_TOO_FREQUENT"

    INACTIVE_USER = "INACTIVE_USER"


_HTTP_STATUS_CODES: dict[int, str] = {
    400: ErrorCode.BAD_REQUEST,
    401: ErrorCode.UNAUTHORIZED,
    403: ErrorCode.FORBIDDEN,
    404: ErrorCode.NOT_FOUND,
    409: ErrorCode.CONFLICT,
    422: ErrorCode.VALIDATION_ERROR,
    429: ErrorCode.RATE_LIMITED,
    500: ErrorCode.INTERNAL_SERVER_ERROR,
    503: ErrorCode.SERVICE_UNAVAILABLE,
}

_VERIFICATION_ERROR_DETAILS: dict[str, str] = {
    ErrorCode.CODE_EXPIRED: "验证码已过期",
    ErrorCode.CODE_INVALID: "验证码错误",
    ErrorCode.TOO_MANY_ATTEMPTS: "尝试次数过多，请稍后再试",
    ErrorCode.RESEND_TOO_FREQUENT: "重发过于频繁",
}


class AppError(Exception):
    default_code = ErrorCode.INTERNAL_SERVER_ERROR
    default_detail: object = "Internal Server Error"
    default_status_code = 500
    expected = True

    def __init__(
        self,
        detail: object | None = None,
        *,
        code: str | None = None,
        status_code: int | None = None,
    ) -> None:
        self.code = code or self.default_code
        self.detail = self.default_detail if detail is None else detail
        self.status_code = status_code or self.default_status_code
        super().__init__(str(self.detail))


class VerificationError(AppError):
    default_code = ErrorCode.UNAUTHORIZED
    default_detail = "Verification failed"
    default_status_code = 401


class CodeExpiredError(VerificationError):
    default_code = ErrorCode.CODE_EXPIRED
    default_detail = _VERIFICATION_ERROR_DETAILS[ErrorCode.CODE_EXPIRED]


class CodeInvalidError(VerificationError):
    default_code = ErrorCode.CODE_INVALID
    default_detail = _VERIFICATION_ERROR_DETAILS[ErrorCode.CODE_INVALID]


class TooManyAttemptsError(VerificationError):
    default_code = ErrorCode.TOO_MANY_ATTEMPTS
    default_detail = _VERIFICATION_ERROR_DETAILS[ErrorCode.TOO_MANY_ATTEMPTS]
    default_status_code = 429


class ResendTooFrequentError(VerificationError):
    default_code = ErrorCode.RESEND_TOO_FREQUENT
    default_detail = _VERIFICATION_ERROR_DETAILS[ErrorCode.RESEND_TOO_FREQUENT]
    default_status_code = 429


_VERIFICATION_ERRORS: dict[str, type[VerificationError]] = {
    ErrorCode.CODE_EXPIRED: CodeExpiredError,
    ErrorCode.CODE_INVALID: CodeInvalidError,
    ErrorCode.TOO_MANY_ATTEMPTS: TooManyAttemptsError,
    ErrorCode.RESEND_TOO_FREQUENT: ResendTooFrequentError,
}


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def error_code_for_status(status_code: int) -> str:
    return _HTTP_STATUS_CODES.get(status_code, ErrorCode.HTTP_ERROR)


def build_error_payload(detail: object, code: str, *, timestamp: str | None = None) -> dict:
    return {
        "detail": detail,
        "code": code,
        "timestamp": timestamp or utc_timestamp(),
    }


def build_http_error_detail(error: AppError) -> dict:
    return {"detail": error.detail, "code": error.code}


def build_tool_error_payload(
    error: AppError | None = None,
    *,
    detail: object | None = None,
    code: str | None = None,
    ensure_ascii: bool = False,
) -> str:
    if error is not None:
        detail = error.detail
        code = error.code
    if detail is None or code is None:
        raise ValueError("detail and code are required when error is not provided")
    return json.dumps(build_error_payload(detail, code), ensure_ascii=ensure_ascii)


def verification_error_from_code(code: str) -> VerificationError | None:
    error_type = _VERIFICATION_ERRORS.get(code)
    if error_type is None:
        return None
    return error_type()


def error_payload(detail: object, code: str) -> dict:
    return build_error_payload(detail, code)


def error_payload_from_exception(detail: object, status_code: int) -> dict:
    if isinstance(detail, dict) and "detail" in detail and "code" in detail:
        payload = dict(detail)
        if "timestamp" not in payload:
            payload["timestamp"] = utc_timestamp()
        return payload
    return error_payload(detail, error_code_for_status(status_code))


def error_payload_json(detail: object, code: str, *, ensure_ascii: bool = False) -> str:
    return build_tool_error_payload(detail=detail, code=code, ensure_ascii=ensure_ascii)


def verification_error_payload(detail: str) -> dict | None:
    error = verification_error_from_code(detail)
    if error is None:
        return None
    return build_http_error_detail(error)
