import json

from backend.core.errors import (
    CodeInvalidError,
    ErrorCode,
    build_http_error_detail,
    build_tool_error_payload,
    error_payload_from_exception,
)


def test_verification_error_carries_canonical_semantics():
    error = CodeInvalidError()

    assert error.code == ErrorCode.CODE_INVALID
    assert error.detail == "验证码错误"
    assert error.status_code == 401
    assert str(error) == "验证码错误"


def test_http_and_tool_presenters_share_canonical_semantics():
    error = CodeInvalidError()

    http_detail = build_http_error_detail(error)
    tool_payload = json.loads(build_tool_error_payload(error))

    assert http_detail == {"detail": "验证码错误", "code": ErrorCode.CODE_INVALID}
    assert tool_payload["detail"] == http_detail["detail"]
    assert tool_payload["code"] == http_detail["code"]
    assert tool_payload["timestamp"].endswith("Z")


def test_structured_http_exception_detail_gets_timestamp_without_losing_code():
    detail = build_http_error_detail(CodeInvalidError())

    payload = error_payload_from_exception(detail, 401)

    assert payload["detail"] == "验证码错误"
    assert payload["code"] == ErrorCode.CODE_INVALID
    assert payload["timestamp"].endswith("Z")
