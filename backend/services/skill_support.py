import json
import re
from dataclasses import dataclass
import zipfile

import yaml

from backend.core.utils.key_derivation import derive_aes256_key
from backend.core.utils.process_exec import quote_shell_arg
from backend.core.utils.skill_storage import MAX_FILES_PER_SKILL, MAX_FILE_SIZE, MAX_TOTAL_SIZE, validate_file_path
from backend.services.skill_errors import SkillError, SkillErrorCode


@dataclass(frozen=True)
class ValidatedArchive:
    archive: zipfile.ZipFile
    entries: list[object]
    entry_names: set[str]


def parse_frontmatter(content: str) -> dict:
    stripped = content.lstrip()
    if not stripped.startswith("---"):
        return {}
    parts = stripped.split("---", 2)
    if len(parts) < 3:
        return {}
    frontmatter_text = parts[1].strip()
    if not frontmatter_text:
        return {}
    try:
        parsed = yaml.safe_load(frontmatter_text)
    except yaml.YAMLError:
        return {}
    if isinstance(parsed, dict):
        return parsed
    return {}


def validate_version(version: str) -> str:
    normalized = str(version or "").strip()
    if not normalized:
        raise SkillError(SkillErrorCode.INVALID_VERSION)
    if len(normalized) > 100:
        raise SkillError(SkillErrorCode.INVALID_VERSION)
    if normalized.startswith("."):
        raise SkillError(SkillErrorCode.INVALID_VERSION)
    if "/" in normalized or "\\" in normalized:
        raise SkillError(SkillErrorCode.INVALID_VERSION)
    if ".." in normalized or normalized in {".", ".."}:
        raise SkillError(SkillErrorCode.INVALID_VERSION)
    if not re.fullmatch(r"[a-zA-Z0-9_\-\.]+", normalized):
        raise SkillError(SkillErrorCode.INVALID_VERSION)
    return normalized


def normalize_dependencies(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def parse_requirements_text(text: str) -> list[str]:
    items: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        items.append(stripped)
    return items


def build_encryption_key(value: str, purpose: str = "skill-download-encryption") -> bytes:
    return derive_aes256_key(value, purpose)


def normalize_dependency_spec(value: object) -> dict | None:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except Exception:
            return None
        if isinstance(parsed, dict):
            return parsed
    return None


def normalize_explicit_dependency_spec(spec: dict) -> dict:
    normalized = dict(spec)
    python_spec = normalized.get("python")
    if not isinstance(python_spec, dict):
        return normalized

    manager = str(python_spec.get("manager") or "uv").strip().lower()
    if manager != "uv":
        raise SkillError(
            SkillErrorCode.INVALID_METADATA,
            "dependency_spec.python.manager must be 'uv'",
        )

    normalized_python = dict(python_spec)
    normalized_python["manager"] = "uv"
    normalized["python"] = normalized_python
    return normalized


def parse_semver(version: str) -> tuple[str, int, int, int] | None:
    match = re.fullmatch(r"(v)?(\d+)\.(\d+)\.(\d+)", version)
    if not match:
        return None
    prefix = "v" if match.group(1) else ""
    return prefix, int(match.group(2)), int(match.group(3)), int(match.group(4))


async def next_version(skill, repo, strategy: str = "patch") -> str:
    candidates: list[str] = []
    if skill.current_version:
        candidates.append(skill.current_version)
    versions = await repo.list_by_skill(skill.id)
    candidates.extend([record.version for record in versions if record.version])
    parsed_versions = [parse_semver(item) for item in candidates]
    semvers = [item for item in parsed_versions if item is not None]
    if not semvers:
        return "1.0.0"
    prefix, major, minor, patch = max(semvers, key=lambda item: (item[1], item[2], item[3]))
    strategy = (strategy or "patch").strip().lower()
    if strategy == "minor":
        next_major = major
        next_minor = minor + 1
        next_patch = 0
        next_value = f"{prefix}{next_major}.{next_minor}.{next_patch}"
        while await repo.get_by_version(skill.id, next_value):
            next_minor += 1
            next_value = f"{prefix}{next_major}.{next_minor}.{next_patch}"
        return next_value
    next_patch = patch + 1
    next_value = f"{prefix}{major}.{minor}.{next_patch}"
    while await repo.get_by_version(skill.id, next_value):
        next_patch += 1
        next_value = f"{prefix}{major}.{minor}.{next_patch}"
    return next_value


def detect_python_dependency_spec(
    entry_names: set[str],
    archive,
    requirements: list[str],
) -> tuple[dict[str, object], list[str]]:
    python_spec: dict[str, object] = {}
    deps = list(requirements)
    if "pyproject.toml" in entry_names:
        has_uv_lock = "uv.lock" in entry_names
        python_spec = {
            "manager": "uv",
            "requirements": deps,
            "files": ["pyproject.toml"],
            "lockfile": "uv.lock" if has_uv_lock else None,
        }
    elif "requirements.txt" in entry_names:
        try:
            requirements_text = archive.read("requirements.txt").decode("utf-8", errors="replace")
        except Exception:
            requirements_text = ""
        parsed = parse_requirements_text(requirements_text)
        if parsed:
            deps = parsed
        python_spec = {
            "manager": "uv",
            "requirements": deps,
            "files": ["requirements.txt"],
        }
    if not python_spec and deps:
        python_spec = {
            "manager": "uv",
            "requirements": deps,
            "files": [],
        }
    return python_spec, deps


def clean_dependency_items(items: object) -> list[str]:
    if not isinstance(items, list):
        return []
    return [str(item) for item in items if str(item).strip()]


def build_uv_pip_install_command(requirements: list[str]) -> str | None:
    quoted_requirements = [quote_shell_arg(item) for item in requirements if item.strip()]
    if not quoted_requirements:
        return None
    return "uv pip install " + " ".join(quoted_requirements)


def build_python_commands(manager: str, requirements: list[str], files: list[str]) -> list[str]:
    commands: list[str] = []
    manager = (manager or "uv").strip().lower()
    if manager not in {"uv", "pip"}:
        return commands
    if "pyproject.toml" in files:
        commands.append("uv sync")
    elif "requirements.txt" in files:
        commands.append("uv pip install -r requirements.txt")
    else:
        inline_install = build_uv_pip_install_command(requirements)
        if inline_install:
            commands.append(inline_install)
    return commands


def build_node_commands(manager: str, has_lockfile: bool) -> list[str]:
    if manager == "pnpm":
        return ["pnpm install"]
    if manager == "yarn":
        return ["yarn install"]
    return ["npm ci" if has_lockfile else "npm install"]


def parse_metadata_text(metadata_text: str | None) -> dict:
    if not metadata_text:
        return {}
    try:
        parsed = json.loads(metadata_text)
    except json.JSONDecodeError as exc:
        raise SkillError(SkillErrorCode.INVALID_METADATA) from exc
    return parsed if isinstance(parsed, dict) else {}


def validate_zip_archive(filename: str, archive_path, missing_skill_code: SkillErrorCode) -> ValidatedArchive:
    if not filename.lower().endswith(".zip"):
        raise SkillError(SkillErrorCode.INVALID_ZIP_FILE)
    try:
        archive = zipfile.ZipFile(archive_path)
    except zipfile.BadZipFile as exc:
        raise SkillError(SkillErrorCode.INVALID_ZIP_FILE) from exc

    entries = [info for info in archive.infolist() if not info.is_dir()]
    if not entries:
        archive.close()
        raise SkillError(SkillErrorCode.ZIP_EMPTY)
    if len(entries) > MAX_FILES_PER_SKILL:
        archive.close()
        raise SkillError(SkillErrorCode.TOO_MANY_FILES)
    total_size = sum(info.file_size for info in entries)
    if total_size > MAX_TOTAL_SIZE:
        archive.close()
        raise SkillError(SkillErrorCode.TOTAL_SKILL_SIZE_LIMIT_EXCEEDED)
    for info in entries:
        if info.file_size > MAX_FILE_SIZE:
            archive.close()
            raise SkillError(SkillErrorCode.FILE_TOO_LARGE)
        file_path = info.filename.replace("\\", "/").lstrip("/")
        valid, error = validate_file_path(file_path)
        if not valid:
            archive.close()
            raise SkillError(SkillErrorCode.INVALID_FILE_PATH, error)
    entry_names = {info.filename.replace("\\", "/").lstrip("/") for info in entries}
    if "SKILL.md" not in entry_names:
        archive.close()
        raise SkillError(missing_skill_code)
    return ValidatedArchive(archive=archive, entries=entries, entry_names=entry_names)


def read_skill_frontmatter(archive: object) -> dict:
    skill_md_content = archive.read("SKILL.md").decode("utf-8", errors="replace")
    return parse_frontmatter(skill_md_content)


def build_dependency_spec_from_archive(
    archive: object,
    entry_names: set[str],
    dependencies: list[str],
    explicit_dependency_spec: dict | None,
) -> tuple[list[str], dict, str | None]:
    if explicit_dependency_spec is not None:
        dependency_spec = normalize_explicit_dependency_spec(explicit_dependency_spec)
        return dependencies, dependency_spec, str(dependency_spec.get("schema_version") or "1")

    dependency_spec: dict[str, object] = {"schema_version": 1}
    dependency_spec_version = "1"
    node_spec: dict[str, object] = {}
    python_spec, detected_dependencies = detect_python_dependency_spec(entry_names, archive, [])
    if detected_dependencies:
        dependencies = detected_dependencies
    if "package.json" in entry_names:
        try:
            package_json = json.loads(archive.read("package.json").decode("utf-8", errors="replace"))
        except json.JSONDecodeError:
            package_json = {}
        lockfile = "package-lock.json" if "package-lock.json" in entry_names else ""
        node_spec = {
            "manager": "npm",
            "package_json": package_json,
            "lockfile": lockfile or None,
        }
    if python_spec:
        dependency_spec["python"] = python_spec
    if node_spec:
        dependency_spec["node"] = node_spec
    return dependencies, dependency_spec, dependency_spec_version


__all__ = [
    "build_encryption_key",
    "build_dependency_spec_from_archive",
    "build_node_commands",
    "build_python_commands",
    "build_uv_pip_install_command",
    "clean_dependency_items",
    "detect_python_dependency_spec",
    "parse_metadata_text",
    "next_version",
    "normalize_dependencies",
    "normalize_dependency_spec",
    "normalize_explicit_dependency_spec",
    "parse_frontmatter",
    "parse_requirements_text",
    "parse_semver",
    "read_skill_frontmatter",
    "validate_version",
    "validate_zip_archive",
]
