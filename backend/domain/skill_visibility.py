from __future__ import annotations

import json
from enum import StrEnum
from pathlib import Path
from typing import Literal, cast


SkillVisibilityValue = Literal["private", "team", "enterprise", "public"]
WritableSkillVisibility = Literal["private", "team", "enterprise"]

_SKILL_VISIBILITY_CATALOG = json.loads(
    Path(__file__).with_name("skill-visibilities.json").read_text(encoding="utf-8"),
)

SKILL_VISIBILITY_VALUES = tuple(_SKILL_VISIBILITY_CATALOG["values"])
WRITABLE_SKILL_VISIBILITY_VALUES = tuple(_SKILL_VISIBILITY_CATALOG["writable"])
DEFAULT_SKILL_VISIBILITY = cast(WritableSkillVisibility, _SKILL_VISIBILITY_CATALOG["default"])
SKILL_VISIBILITY_LABELS = {
    visibility: _SKILL_VISIBILITY_CATALOG["labels"][visibility]
    for visibility in SKILL_VISIBILITY_VALUES
}


class SkillVisibility(StrEnum):
    PRIVATE = "private"
    TEAM = "team"
    ENTERPRISE = "enterprise"
    PUBLIC = "public"


if tuple(visibility.value for visibility in SkillVisibility) != SKILL_VISIBILITY_VALUES:
    raise RuntimeError("SkillVisibility enum values must match skill-visibilities.json")

if not set(WRITABLE_SKILL_VISIBILITY_VALUES).issubset(set(SKILL_VISIBILITY_VALUES)):
    raise RuntimeError("Writable skill visibility values must be a subset of skill visibility values")

if DEFAULT_SKILL_VISIBILITY not in WRITABLE_SKILL_VISIBILITY_VALUES:
    raise RuntimeError("Default skill visibility must be writable")


PRIVATE_SKILL_VISIBILITY: SkillVisibilityValue = "private"
TEAM_SKILL_VISIBILITY: SkillVisibilityValue = "team"
ENTERPRISE_SKILL_VISIBILITY: SkillVisibilityValue = "enterprise"
PUBLIC_SKILL_VISIBILITY: SkillVisibilityValue = "public"


def is_skill_visibility(value: str) -> bool:
    return value in SKILL_VISIBILITY_VALUES


def is_writable_skill_visibility(value: str) -> bool:
    return value in WRITABLE_SKILL_VISIBILITY_VALUES


def normalize_skill_visibility(
    value: str | None,
    default: str | None = DEFAULT_SKILL_VISIBILITY,
) -> SkillVisibilityValue:
    normalized = str(value or default or "").strip().lower()
    if not is_skill_visibility(normalized):
        raise ValueError("Invalid visibility")
    return cast(SkillVisibilityValue, normalized)


def normalize_writable_skill_visibility(
    value: str | None,
    default: str | None = DEFAULT_SKILL_VISIBILITY,
) -> WritableSkillVisibility:
    normalized = normalize_skill_visibility(value, default)
    if not is_writable_skill_visibility(normalized):
        raise ValueError("Invalid visibility")
    return cast(WritableSkillVisibility, normalized)
