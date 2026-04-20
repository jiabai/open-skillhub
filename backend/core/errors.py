import json
from datetime import datetime, timezone


_HTTP_STATUS_CODES: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
}

_VERIFICATION_ERROR_MESSAGES: dict[str, str] = {
    "CODE_EXPIRED": "验证码已过期",
    "CODE_INVALID": "验证码错误",
    "TOO_MANY_ATTEMPTS": "尝试次数过多，请稍后再试",
    "RESEND_TOO_FREQUENT": "重发过于频繁",
}


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def error_code_for_status(status_code: int) -> str:
    return _HTTP_STATUS_CODES.get(status_code, "HTTP_ERROR")


def error_payload(detail: object, code: str) -> dict:
    return {
        "detail": detail,
        "code": code,
        "timestamp": utc_timestamp(),
    }


def error_payload_from_exception(detail: object, status_code: int) -> dict:
    if isinstance(detail, dict) and "detail" in detail and "code" in detail:
        payload = dict(detail)
        if "timestamp" not in payload:
            payload["timestamp"] = utc_timestamp()
        return payload
    return error_payload(detail, error_code_for_status(status_code))


def error_payload_json(detail: object, code: str, *, ensure_ascii: bool = False) -> str:
    return json.dumps(error_payload(detail, code), ensure_ascii=ensure_ascii)


def verification_error_payload(detail: str) -> dict | None:
    message = _VERIFICATION_ERROR_MESSAGES.get(detail)
    if not message:
        return None
    return {"detail": message, "code": detail}
