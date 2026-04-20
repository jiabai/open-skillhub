import json
import io
import zipfile

import pytest

from backend.api.v1.skills_support import handle_skill_value_error
from backend.core.utils.skill_storage import tool_error_payload
from backend.services.skill_errors import SkillError, SkillErrorCode
from backend.services.skill_support import (
    build_dependency_spec_from_archive,
    parse_metadata_text,
    read_skill_frontmatter,
    validate_zip_archive,
)


def _build_zip(files: dict[str, str]) -> io.BytesIO:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, content in files.items():
            zf.writestr(path, content)
    buffer.seek(0)
    return buffer


def test_parse_metadata_text_returns_dict():
    metadata = parse_metadata_text('{"version":"1.2.3","description":"demo"}')
    assert metadata == {"version": "1.2.3", "description": "demo"}


def test_parse_metadata_text_ignores_non_dict_json():
    metadata = parse_metadata_text('["x"]')
    assert metadata == {}


def test_parse_metadata_text_invalid_json_raises():
    with pytest.raises(SkillError) as exc:
        parse_metadata_text("{invalid")
    assert exc.value.code == SkillErrorCode.INVALID_METADATA


def test_validate_zip_archive_extracts_entries_and_frontmatter():
    archive_file = _build_zip(
        {
            "SKILL.md": "---\nname: demo\nversion: 1.0.0\n---\nbody",
            "requirements.txt": "requests>=2.0.0\n",
        }
    )

    bundle = validate_zip_archive("demo.zip", archive_file, SkillErrorCode.SKILL_MD_NOT_FOUND)
    with bundle.archive as archive:
        frontmatter = read_skill_frontmatter(archive)

    assert "SKILL.md" in bundle.entry_names
    assert "requirements.txt" in bundle.entry_names
    assert frontmatter["name"] == "demo"
    assert frontmatter["version"] == "1.0.0"


def test_validate_zip_archive_missing_skill_md_raises():
    archive_file = _build_zip({"README.md": "hello"})

    with pytest.raises(SkillError) as exc:
        validate_zip_archive("demo.zip", archive_file, SkillErrorCode.SKILL_MD_NOT_FOUND_IN_ZIP)
    assert exc.value.code == SkillErrorCode.SKILL_MD_NOT_FOUND_IN_ZIP


def test_build_dependency_spec_from_archive_with_explicit_spec():
    archive_file = _build_zip({"SKILL.md": "---\nname: demo\n---\nbody"})
    bundle = validate_zip_archive("demo.zip", archive_file, SkillErrorCode.SKILL_MD_NOT_FOUND)
    explicit_spec = {"schema_version": 2, "python": {"manager": "uv", "requirements": ["requests"], "files": []}}

    with bundle.archive as archive:
        dependencies, dependency_spec, spec_version = build_dependency_spec_from_archive(
            archive,
            bundle.entry_names,
            ["requests"],
            explicit_spec,
        )

    assert dependencies == ["requests"]
    assert dependency_spec["schema_version"] == 2
    assert dependency_spec["python"]["manager"] == "uv"
    assert spec_version == "2"


def test_build_dependency_spec_from_archive_detects_python_and_node():
    archive_file = _build_zip(
        {
            "SKILL.md": "---\nname: demo\n---\nbody",
            "requirements.txt": "requests>=2.0.0\nnumpy\n",
            "package.json": '{"name":"demo","dependencies":{"react":"18.0.0"}}',
            "package-lock.json": '{"lockfileVersion":3}',
        }
    )
    bundle = validate_zip_archive("demo.zip", archive_file, SkillErrorCode.SKILL_MD_NOT_FOUND)

    with bundle.archive as archive:
        dependencies, dependency_spec, spec_version = build_dependency_spec_from_archive(
            archive,
            bundle.entry_names,
            [],
            None,
        )

    assert dependencies == ["requests>=2.0.0", "numpy"]
    assert dependency_spec["python"]["files"] == ["requirements.txt"]
    assert dependency_spec["node"]["manager"] == "npm"
    assert dependency_spec["node"]["lockfile"] == "package-lock.json"
    assert spec_version == "1"


def test_tool_error_payload_uses_shared_error_shape():
    payload = json.loads(tool_error_payload("Tool failed", "TOOL_FAILURE"))
    assert payload["detail"] == "Tool failed"
    assert payload["code"] == "TOOL_FAILURE"
    assert payload["timestamp"].endswith("Z")


def test_handle_skill_value_error_maps_legacy_file_too_large():
    exc = handle_skill_value_error(ValueError("File too large"))
    assert exc.status_code == 413
    assert exc.detail == {
        "detail": "File exceeds maximum size limit",
        "code": SkillErrorCode.FILE_TOO_LARGE.value,
    }


def test_handle_skill_value_error_keeps_legacy_missing_file_unstructured():
    exc = handle_skill_value_error(ValueError("Version files not found"))
    assert exc.status_code == 404
    assert exc.detail == "Version files not found"
