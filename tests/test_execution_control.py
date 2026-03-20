import pytest


@pytest.mark.asyncio
async def test_user_execution_slot_blocks_second_acquire_when_limit_one(monkeypatch):
    from skillhub.config import settings as settings_module
    from skillhub.core.utils.execution_control import acquire_execution_slot

    monkeypatch.setattr(settings_module.settings, "SKILL_MAX_CONCURRENT_EXECUTIONS_PER_USER", 1, raising=False)

    release = await acquire_execution_slot("u-1", "t-1")
    assert release is not None
    blocked = await acquire_execution_slot("u-1", "t-1")
    assert blocked is None
    await release()


def test_workdir_quota_rejects_oversized_directory(tmp_path):
    from skillhub.core.utils.execution_control import is_within_workdir_quota

    payload = b"x" * 64
    file_path = tmp_path / "big.bin"
    file_path.write_bytes(payload)

    assert is_within_workdir_quota(tmp_path, max_bytes=32) is False
    assert is_within_workdir_quota(tmp_path, max_bytes=1024) is True


def test_output_truncation_applies_hard_limit():
    from skillhub.core.utils.execution_control import truncate_output

    raw = "a" * 20
    assert truncate_output(raw, 5) == "aaaaa"
