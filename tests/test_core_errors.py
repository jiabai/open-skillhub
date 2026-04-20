import pytest

from backend.core.errors import error_code_for_status


@pytest.mark.parametrize(
    ("status_code", "expected"),
    [
        (429, "RATE_LIMITED"),
        (500, "INTERNAL_SERVER_ERROR"),
        (503, "SERVICE_UNAVAILABLE"),
        (418, "HTTP_ERROR"),
    ],
)
def test_error_code_for_status_maps_common_http_errors(status_code, expected):
    assert error_code_for_status(status_code) == expected
