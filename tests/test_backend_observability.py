import pytest

from backend.core.middleware import logging as logging_module


def test_safe_log_context_masks_sensitive_values():
    safe_log_context = getattr(logging_module, "safe_log_context", None)

    assert safe_log_context is not None
    assert safe_log_context(
        user_id="user-123456789",
        email="person@example.com",
        token="secret-token-value",
        none_value=None,
        numeric=3,
    ) == {
        "user_id": "user...6789",
        "email": "per...com",
        "token": "<redacted>",
        "none_value": None,
        "numeric": 3,
    }


@pytest.mark.asyncio
async def test_unhandled_exception_handler_logs_exception(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from backend.api._exceptions import register_exception_handlers

    captured: list[str] = []

    class _Recorder:
        def bind(self, **_kwargs):
            return self

        def exception(self, message: str):
            captured.append(message)

    monkeypatch.setattr("backend.api._exceptions.logger", _Recorder())

    application = FastAPI()
    register_exception_handlers(application)

    @application.get("/broken")
    async def broken():
        raise RuntimeError("boom")

    with TestClient(application, raise_server_exceptions=False) as client:
        response = client.get("/broken")

    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_SERVER_ERROR"
    assert captured == ["Unhandled request exception"]
