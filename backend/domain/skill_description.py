MAX_SKILL_DESCRIPTION_LENGTH = 500


def normalize_skill_description(value: object) -> str:
    """Return the bounded summary stored on Skill and SkillVersion records."""
    return str(value or "").strip()[:MAX_SKILL_DESCRIPTION_LENGTH]
