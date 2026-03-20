import io
import os

import pytest


@pytest.mark.asyncio
async def test_local_archive_roundtrip(tmp_path, monkeypatch):
    from skillhub.config import settings as settings_module

    monkeypatch.setattr(settings_module.settings, "SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings_module.settings, "SKILL_ARCHIVE_BACKEND", "local")
    from skillhub.core.utils.skill_archive import load_archive, save_archive

    payload = b"zip-content"
    await save_archive("user-1", "skill-1", "1.0.0", payload)
    loaded = await load_archive("user-1", "skill-1", "1.0.0")
    assert loaded == payload


@pytest.mark.asyncio
async def test_s3_archive_roundtrip(monkeypatch):
    from skillhub.config import settings as settings_module

    monkeypatch.setattr(settings_module.settings, "SKILL_ARCHIVE_BACKEND", "s3")
    monkeypatch.setattr(settings_module.settings, "SKILL_ARCHIVE_S3_BUCKET", "bucket")
    monkeypatch.setattr(settings_module.settings, "SKILL_ARCHIVE_S3_ENDPOINT", "https://s3.test")
    monkeypatch.setattr(settings_module.settings, "SKILL_ARCHIVE_S3_ACCESS_KEY_ID", "key")
    monkeypatch.setattr(settings_module.settings, "SKILL_ARCHIVE_S3_SECRET_ACCESS_KEY", "secret")
    from skillhub.core.utils import skill_archive

    stored = io.BytesIO()

    class FakeClient:
        def put_object(self, Bucket, Key, Body):
            stored.seek(0)
            stored.truncate(0)
            stored.write(Body)

        def get_object(self, Bucket, Key):
            stored.seek(0)
            return {"Body": io.BytesIO(stored.read())}

    monkeypatch.setattr(skill_archive, "_get_s3_client", lambda: FakeClient())

    payload = b"s3-content"
    await skill_archive.save_archive("user-2", "skill-2", "2.0.0", payload)
    loaded = await skill_archive.load_archive("user-2", "skill-2", "2.0.0")
    assert loaded == payload


@pytest.mark.asyncio
async def test_local_archive_expired_cache_is_cleaned(tmp_path, monkeypatch):
    from skillhub.config import settings as settings_module
    from skillhub.core.utils import skill_archive

    monkeypatch.setattr(settings_module.settings, "SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings_module.settings, "SKILL_ARCHIVE_BACKEND", "local")
    monkeypatch.setattr(settings_module.settings, "SKILL_CACHE_TTL_SECONDS", 1)

    payload = b"expired-content"
    await skill_archive.save_archive("user-3", "skill-3", "3.0.0", payload)
    archive_path = skill_archive._archive_path("user-3", "skill-3", "3.0.0")
    stale_ts = int(os.path.getmtime(archive_path)) - 10
    os.utime(archive_path, (stale_ts, stale_ts))

    loaded = await skill_archive.load_archive("user-3", "skill-3", "3.0.0")
    assert loaded is None
    assert not archive_path.exists()


@pytest.mark.asyncio
async def test_s3_archive_falls_back_to_local_cache_when_offline(tmp_path, monkeypatch):
    from skillhub.config import settings as settings_module
    from skillhub.core.utils import skill_archive

    monkeypatch.setattr(settings_module.settings, "SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings_module.settings, "SKILL_ARCHIVE_BACKEND", "s3")
    monkeypatch.setattr(settings_module.settings, "SKILL_ARCHIVE_S3_BUCKET", "bucket")
    monkeypatch.setattr(settings_module.settings, "SKILL_ARCHIVE_S3_ENDPOINT", "https://s3.test")
    monkeypatch.setattr(settings_module.settings, "SKILL_ARCHIVE_S3_ACCESS_KEY_ID", "key")
    monkeypatch.setattr(settings_module.settings, "SKILL_ARCHIVE_S3_SECRET_ACCESS_KEY", "secret")
    monkeypatch.setattr(settings_module.settings, "ENABLE_LOCAL_CACHE_ENCRYPTION", True)
    monkeypatch.setattr(settings_module.settings, "ENABLE_CACHE_OFFLINE_FALLBACK", True)
    monkeypatch.setattr(settings_module.settings, "SKILL_CACHE_TTL_SECONDS", 3600)

    class FlakyClient:
        def put_object(self, Bucket, Key, Body):
            return None

        def get_object(self, Bucket, Key):
            raise RuntimeError("network unavailable")

    monkeypatch.setattr(skill_archive, "_get_s3_client", lambda: FlakyClient())

    payload = b"fallback-content"
    await skill_archive.save_archive("user-4", "skill-4", "4.0.0", payload)
    loaded = await skill_archive.load_archive("user-4", "skill-4", "4.0.0")
    assert loaded == payload
