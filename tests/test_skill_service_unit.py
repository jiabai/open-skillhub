"""
SkillService 核心方法单元测试
专注于静态方法和验证逻辑，不依赖数据库
"""
import pytest

from backend.services.skill import SkillService


class TestSkillServiceStaticMethods:
    """测试 SkillService 的静态方法"""

    def test_validate_version_valid_versions(self):
        """测试有效版本号"""
        assert SkillService._validate_version("1.0.0") == "1.0.0"
        assert SkillService._validate_version("v1.0.0") == "v1.0.0"
        assert SkillService._validate_version("2.3.4") == "2.3.4"
        assert SkillService._validate_version("10.20.30") == "10.20.30"
        assert SkillService._validate_version("1.0.0-alpha") == "1.0.0-alpha"
        assert SkillService._validate_version("1.0.0-beta.1") == "1.0.0-beta.1"
        assert SkillService._validate_version("1.0.0-rc.1") == "1.0.0-rc.1"

    def test_validate_version_invalid_empty(self):
        """测试空版本号"""
        with pytest.raises(ValueError, match="Invalid version"):
            SkillService._validate_version("")

    def test_validate_version_invalid_dots(self):
        """测试无效的点号"""
        with pytest.raises(ValueError, match="Invalid version"):
            SkillService._validate_version("")
        with pytest.raises(ValueError, match="Invalid version"):
            SkillService._validate_version(".")
        with pytest.raises(ValueError, match="Invalid version"):
            SkillService._validate_version("..")
        with pytest.raises(ValueError, match="Invalid version"):
            SkillService._validate_version("1.0.0/../etc")

    def test_validate_version_invalid_path_traversal(self):
        """测试路径遍历攻击"""
        with pytest.raises(ValueError, match="Invalid version"):
            SkillService._validate_version("../etc/passwd")
        with pytest.raises(ValueError, match="Invalid version"):
            SkillService._validate_version("1.0.0/../etc")
        with pytest.raises(ValueError, match="Invalid version"):
            SkillService._validate_version("v1/../../../etc")

    def test_validate_version_invalid_slashes(self):
        """测试斜杠"""
        with pytest.raises(ValueError, match="Invalid version"):
            SkillService._validate_version("1.0.0/test")
        with pytest.raises(ValueError, match="Invalid version"):
            SkillService._validate_version("1.0.0\\test")

    def test_validate_version_invalid_chars(self):
        """测试无效字符"""
        with pytest.raises(ValueError, match="Invalid version"):
            SkillService._validate_version("1.0.0!")
        with pytest.raises(ValueError, match="Invalid version"):
            SkillService._validate_version("1.0.0@")
        with pytest.raises(ValueError, match="Invalid version"):
            SkillService._validate_version("1.0.0#")

    def test_validate_version_too_long(self):
        """测试过长版本号"""
        long_version = "a" * 101
        with pytest.raises(ValueError, match="Invalid version"):
            SkillService._validate_version(long_version)

    def test_parse_frontmatter_complete(self):
        """测试完整 frontmatter 解析"""
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
        """测试最小 frontmatter"""
        content = """---
name: minimal
---
Content"""
        result = SkillService._parse_frontmatter(content)
        assert result["name"] == "minimal"

    def test_parse_frontmatter_no_markers(self):
        """测试没有 frontmatter 标记"""
        content = "# Just content\nNo frontmatter here"
        result = SkillService._parse_frontmatter(content)
        assert result == {}

    def test_parse_frontmatter_empty_content(self):
        """测试空内容"""
        assert SkillService._parse_frontmatter("") == {}
        assert SkillService._parse_frontmatter("   ") == {}

    def test_parse_frontmatter_unclosed(self):
        """测试未闭合的 frontmatter"""
        content = """---
name: unclosed
# Missing closing"""
        result = SkillService._parse_frontmatter(content)
        assert result == {}

    def test_parse_frontmatter_invalid_yaml(self):
        """测试无效 YAML"""
        content = """---
invalid: [yaml
---
# Content"""
        result = SkillService._parse_frontmatter(content)
        assert result == {}

    def test_parse_frontmatter_list_instead_of_dict(self):
        """测试返回列表而非字典"""
        content = """---
- item1
- item2
---
# Content"""
        result = SkillService._parse_frontmatter(content)
        assert result == {}

    def test_parse_frontmatter_with_leading_whitespace(self):
        """测试有前导空白"""
        content = """
  ---
name: whitespace
---
Content"""
        result = SkillService._parse_frontmatter(content)
        assert result["name"] == "whitespace"

    def test_normalize_dependencies_list(self):
        """测试列表形式依赖"""
        result = SkillService._normalize_dependencies(["requests", "numpy>=1.0"])
        assert result == ["requests", "numpy>=1.0"]

    def test_normalize_dependencies_string(self):
        """测试字符串形式依赖"""
        result = SkillService._normalize_dependencies("requests, numpy>=1.0, pandas")
        assert result == ["requests", "numpy>=1.0", "pandas"]

    def test_normalize_dependencies_empty_string(self):
        """测试空字符串"""
        result = SkillService._normalize_dependencies("")
        assert result == []

    def test_normalize_dependencies_none(self):
        """测试 None"""
        result = SkillService._normalize_dependencies(None)
        assert result == []

    def test_normalize_dependencies_number(self):
        """测试数字"""
        result = SkillService._normalize_dependencies(123)
        assert result == []

    def test_parse_requirements_text_standard(self):
        """测试标准 requirements"""
        text = """requests>=2.0.0
numpy>=1.20.0
pandas>=1.3.0"""
        result = SkillService._parse_requirements_text(text)
        assert "requests>=2.0.0" in result
        assert "numpy>=1.20.0" in result
        assert "pandas>=1.3.0" in result

    def test_parse_requirements_text_with_comments(self):
        """测试带注释"""
        text = """# Core dependencies
requests>=2.0.0
# Data processing
numpy>=1.20.0"""
        result = SkillService._parse_requirements_text(text)
        assert len(result) == 2
        assert "# Core dependencies" not in result
        assert "# Data processing" not in result

    def test_parse_requirements_text_with_blank_lines(self):
        """测试带空行"""
        text = """requests>=2.0.0

numpy>=1.20.0

pandas>=1.3.0"""
        result = SkillService._parse_requirements_text(text)
        assert len(result) == 3

    def test_parse_semver_standard(self):
        """测试标准 SemVer"""
        assert SkillService._parse_semver("1.2.3") == ("", 1, 2, 3)
        assert SkillService._parse_semver("10.20.30") == ("", 10, 20, 30)
        assert SkillService._parse_semver("0.0.1") == ("", 0, 0, 1)

    def test_parse_semver_with_v_prefix(self):
        """测试带 v 前缀"""
        assert SkillService._parse_semver("v1.2.3") == ("v", 1, 2, 3)
        assert SkillService._parse_semver("v10.20.30") == ("v", 10, 20, 30)

    def test_parse_semver_invalid(self):
        """测试无效 SemVer"""
        assert SkillService._parse_semver("1.2") is None
        assert SkillService._parse_semver("1.2.3.4") is None
        assert SkillService._parse_semver("v1.2") is None
        assert SkillService._parse_semver("invalid") is None
        assert SkillService._parse_semver("") is None

    def test_build_encryption_key_deterministic(self):
        """测试加密密钥确定性"""
        key1 = SkillService._build_encryption_key("test-key")
        key2 = SkillService._build_encryption_key("test-key")
        assert key1 == key2

    def test_build_encryption_key_different_keys(self):
        """测试不同输入产生不同密钥"""
        key1 = SkillService._build_encryption_key("key1")
        key2 = SkillService._build_encryption_key("key2")
        assert key1 != key2

    def test_build_encryption_key_length(self):
        """测试密钥长度"""
        key = SkillService._build_encryption_key("any-key")
        assert len(key) == 32  # SHA256

    def test_checksum_payload_consistent(self):
        """测试校验和一致性"""
        payload = b"test data"
        checksum1 = SkillService._checksum_payload(payload)
        checksum2 = SkillService._checksum_payload(payload)
        assert checksum1 == checksum2

    def test_checksum_payload_format(self):
        """测试校验和格式"""
        payload = b"test"
        checksum = SkillService._checksum_payload(payload)
        assert checksum.startswith("sha256:")
        assert len(checksum) == 71  # "sha256:" + 64 hex chars

    def test_checksum_payload_different_data(self):
        """测试不同数据不同校验和"""
        checksum1 = SkillService._checksum_payload(b"data1")
        checksum2 = SkillService._checksum_payload(b"data2")
        assert checksum1 != checksum2

    def test_normalize_dependency_spec_dict(self):
        """测试字典形式依赖规范"""
        spec = {"python": {"manager": "pip", "requirements": ["requests"]}}
        result = SkillService._normalize_dependency_spec(spec)
        assert result == spec

    def test_normalize_dependency_spec_json_string(self):
        """测试 JSON 字符串形式"""
        json_str = '{"python": {"manager": "pip"}}'
        result = SkillService._normalize_dependency_spec(json_str)
        assert result == {"python": {"manager": "pip"}}

    def test_normalize_dependency_spec_invalid_json(self):
        """测试无效 JSON"""
        result = SkillService._normalize_dependency_spec("not json")
        assert result is None

    def test_normalize_dependency_spec_none(self):
        """测试 None"""
        result = SkillService._normalize_dependency_spec(None)
        assert result is None

    def test_normalize_dependency_spec_number(self):
        """测试数字"""
        result = SkillService._normalize_dependency_spec(123)
        assert result is None

    def test_build_python_commands_pip_with_requirements(self):
        """测试 pip 带 requirements.txt"""
        cmds = SkillService._build_python_commands(
            "pip", ["requests>=2.0.0"], ["requirements.txt", "setup.py"]
        )
        assert "pip install -r requirements.txt" in cmds
        assert "pip install requests>=2.0.0" in cmds

    def test_build_python_commands_pip_no_requirements_file(self):
        """测试 pip 无 requirements.txt"""
        cmds = SkillService._build_python_commands("pip", ["requests"], [])
        assert "pip install requests" in cmds
        assert "pip install -r requirements.txt" not in cmds

    def test_build_python_commands_poetry(self):
        """测试 poetry"""
        cmds = SkillService._build_python_commands("poetry", [], [])
        assert cmds == ["poetry install"]

    def test_build_python_commands_uv_with_requirements(self):
        """测试 uv 带 requirements.txt"""
        cmds = SkillService._build_python_commands("uv", [], ["requirements.txt"])
        assert "uv pip install -r requirements.txt" in cmds

    def test_build_python_commands_uv_without_requirements(self):
        """测试 uv 无 requirements.txt"""
        cmds = SkillService._build_python_commands("uv", [], [])
        assert "uv pip install" in cmds

    def test_build_python_commands_conda_with_environment_yml(self):
        """测试 conda 带 environment.yml"""
        cmds = SkillService._build_python_commands("conda", [], ["environment.yml"])
        assert "conda env create -f environment.yml" in cmds

    def test_build_python_commands_empty(self):
        """测试空依赖"""
        cmds = SkillService._build_python_commands("pip", [], [])
        assert cmds == []

    def test_build_node_commands_npm_with_lockfile(self):
        """测试 npm 带 lockfile"""
        cmds = SkillService._build_node_commands("npm", True)
        assert cmds == ["npm ci"]

    def test_build_node_commands_npm_without_lockfile(self):
        """测试 npm 无 lockfile"""
        cmds = SkillService._build_node_commands("npm", False)
        assert cmds == ["npm install"]

    def test_build_node_commands_pnpm(self):
        """测试 pnpm"""
        cmds = SkillService._build_node_commands("pnpm", True)
        assert cmds == ["pnpm install"]

    def test_build_node_commands_yarn(self):
        """测试 yarn"""
        cmds = SkillService._build_node_commands("yarn", False)
        assert cmds == ["yarn install"]

    def test_encrypt_payload(self):
        """测试加密功能"""
        payload = b"test payload content"
        encrypted, checksum = SkillService._encrypt_payload(payload)

        # 验证加密结果
        assert encrypted is not None
        assert isinstance(encrypted, str)

        # 验证校验和
        assert checksum.startswith("sha256:")

        # 验证加密后比原始数据长（包含 nonce 和 tag）
        import base64
        encrypted_bytes = base64.b64decode(encrypted)
        assert len(encrypted_bytes) > len(payload)

    def test_encrypt_payload_different_inputs(self):
        """测试不同输入产生不同加密结果"""
        encrypted1, _ = SkillService._encrypt_payload(b"data1")
        encrypted2, _ = SkillService._encrypt_payload(b"data2")
        assert encrypted1 != encrypted2

    def test_encrypt_payload_same_input_different_output(self):
        """测试相同输入产生不同加密结果（因为随机 nonce）"""
        encrypted1, _ = SkillService._encrypt_payload(b"same data")
        # 每次加密应该不同（随机 nonce）
        encrypted3, _ = SkillService._encrypt_payload(b"same data")
        assert encrypted1 != encrypted3  # nonce 不同