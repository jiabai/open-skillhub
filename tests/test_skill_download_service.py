import base64

import pytest

from backend.config.settings import settings
from backend.services.skill_download import SkillDownloadService
from backend.services.skill_errors import SkillError, SkillErrorCode


@pytest.mark.asyncio
async def test_build_download_payload_raises_skill_error_when_version_files_are_missing(monkeypatch):
    async def missing_archive(*_args):
        return None

    monkeypatch.setattr("backend.services.skill_download.load_archive", missing_archive)
    service = SkillDownloadService(lambda payload: ("encrypted", "sha256:encrypted"), lambda payload: "sha256:plain")

    with pytest.raises(SkillError) as exc:
        await service.build_download_payload(
            skill_id="skill-12345678",
            target_version="1.0.0",
            version_dir=None,
            source_user_id="user-1",
            source_skill_name="demo-skill",
        )

    assert exc.value.code == SkillErrorCode.VERSION_FILES_NOT_FOUND


@pytest.mark.asyncio
async def test_build_download_payload_marks_encrypted_checksum_basis(monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_SKILL_DOWNLOAD_ENCRYPTION", True)
    service = SkillDownloadService(
        lambda payload: (base64.b64encode(b"ciphertext").decode("utf-8"), "sha256:ciphertext"),
        lambda payload: "sha256:plaintext",
    )

    payload = await service.build_download_payload(
        skill_id="skill-12345678",
        target_version="1.0.0",
        version_dir=None,
        source_user_id="user-1",
        source_skill_name="demo-skill",
        archive_bytes=b"plaintext archive",
    )

    assert payload["skill_uuid"] == "skill-12345678"
    assert payload["checksum"] == "sha256:ciphertext"
    assert payload["checksum_basis"] == "encrypted_payload"
    assert payload["warning"] is None


@pytest.mark.asyncio
async def test_build_download_payload_warns_and_marks_plaintext_checksum_basis(monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_SKILL_DOWNLOAD_ENCRYPTION", False)
    service = SkillDownloadService(lambda payload: ("encrypted", "sha256:encrypted"), lambda payload: "sha256:plain")

    payload = await service.build_download_payload(
        skill_id="skill-12345678",
        target_version="1.0.0",
        version_dir=None,
        source_user_id="user-1",
        source_skill_name="demo-skill",
        archive_bytes=b"plaintext archive",
    )

    assert base64.b64decode(payload["encrypted_code"]) == b"plaintext archive"
    assert payload["checksum"] == "sha256:plain"
    assert payload["checksum_basis"] == "plaintext_archive"
    assert payload["warning"] == "Download is not encrypted"
