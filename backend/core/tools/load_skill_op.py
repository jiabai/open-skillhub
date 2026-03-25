"""Operation for loading a specific skill.

This module provides the LoadSkillOp class which loads the content of a
SKILL.md file from a specified skill directory. The skill directory is
read from {service_config.metadata["skill_dir"]} / {skill_name}. If the
SKILL.md file contains YAML frontmatter, only the content after the
frontmatter is returned; otherwise, the full file content is returned.
"""

from pathlib import Path

from loguru import logger

from flowllm.core.context import C
from flowllm.core.op import BaseAsyncToolOp
from flowllm.core.schema import ToolCall

from backend.core.metrics.tool_call_metrics import record_tool_call
from backend.core.utils.skill_storage import tool_error_payload, validate_skill_name
from backend.core.utils.user_context import get_current_user_id


async def _is_skill_active(skill_name: str, user_id: str | None) -> bool:
    if not user_id:
        return True
    try:
        from backend.db.session import get_async_session
        from backend.repositories.skill import SkillRepository
    except Exception:
        return True
    async for session in get_async_session():
        repo = SkillRepository(session)
        record = await repo.get_by_name(user_id, skill_name)
        if record and not record.is_active:
            return False
        return True
    return True


@C.register_op()
class LoadSkillOp(BaseAsyncToolOp):
    """Operation for loading a specific skill's instructions.

    This tool loads the content of a SKILL.md file for a given skill name.
    The skill directory is read from the service_config.

    The tool:
    1. Takes a skill_name as input
    2. Gets the skill directory from {service_config.metadata["skill_dir"]} / {skill_name}
    3. Reads the SKILL.md file from that directory
    4. If YAML frontmatter is present, returns only the content after it
    5. If no frontmatter is found, returns the full file content

    Returns:
        str: The skill instructions content. If the SKILL.md file has YAML
            frontmatter (delimited by "---"), returns only the content after
            the frontmatter. Otherwise, returns the complete file content.
            If the skill is not found, returns an error message string.

    Note:
        - The skill_name must exist in `C.service_config.metadata["skill_dir"]`
        - The SKILL.md file must exist in the skill directory
        - YAML frontmatter is detected by splitting on "---" delimiters
    """

    def build_tool_call(self) -> ToolCall:
        """Build the tool call definition for load_skill.

        Creates and returns a ToolCall object that defines the load_skill
        tool. This tool requires a skill_name parameter to identify which
        skill's instructions to load.

        Returns:
            ToolCall: A ToolCall object defining the load_skill tool with
                the following properties:
                - name: "load_skill"
                - description: Description of what the tool does
                - input_schema: A schema requiring a "skill_name" string
                    parameter that must be provided
        """
        return ToolCall(
            **{
                "name": "load_skill",
                "description": "Load one skill's instructions from the SKILL.md.",
                "input_schema": {
                    "skill_name": {
                        "type": "string",
                        "description": "skill name",
                        "required": True,
                    },
                },
            },
        )

    async def async_execute(self):
        """Execute the load skill operation.

        Loads the SKILL.md file content for the specified skill name. The
        method gets the skill directory from {service_config.metadata["skill_dir"]} /
        {skill_name}, reads the SKILL.md file, and extracts the instructions
        content (excluding YAML frontmatter if present).

        The method:
        1. Extracts the skill_name from input_dict
        2. Gets the skill directory from {service_config.metadata["skill_dir"]} / {skill_name}
        3. Constructs the path to SKILL.md file
        4. Checks if the file exists
        5. Reads the file content
        6. Splits content by "---" to detect YAML frontmatter
        7. Returns content after frontmatter if present, otherwise full content

        Returns:
            None: The result is set via `self.set_output()` with one of:
                - The skill instructions (content after YAML frontmatter)
                - The full file content (if no frontmatter is found)
                - An error message string (if skill file is not found)

        Raises:
            Error: If skill_name is not found in the skill directory.
                Remember to call LoadSkillMetadataOp before LoadSkillOp and get the available skills.

        Note:
            - If the file has YAML frontmatter (format: "---\n...\n---\n..."),
              only the content after the second "---" is returned
            - If no frontmatter is detected, the entire file content is returned
            - File encoding is assumed to be UTF-8
        """
        exception: Exception | None = None
        try:
            skill_name = self.input_dict["skill_name"]
            valid, error = validate_skill_name(skill_name)
            if not valid:
                self.set_output(tool_error_payload(error, "INVALID_SKILL_NAME"))
                return
            skill_dir = Path(C.service_config.metadata["skill_dir"]).resolve()
            user_id = get_current_user_id()
            logger.info(f"🔧 Tool called: load_skill(skill_name='{skill_name}') with skill_dir={skill_dir}")
            if not await _is_skill_active(skill_name, user_id):
                payload = {"skill_name": skill_name, "message": "Skill deactivated"}
                self.set_output(tool_error_payload(payload, "SKILL_DEACTIVATED"))
                return

            skill_path = (
                skill_dir / user_id / skill_name / "SKILL.md" if user_id else skill_dir / skill_name / "SKILL.md"
            )

            if not skill_path.exists():
                payload = {"skill_name": skill_name, "message": "Skill not found"}
                logger.exception(payload)
                self.set_output(tool_error_payload(payload, "SKILL_NOT_FOUND"))
                return

            content: str = skill_path.read_text(encoding="utf-8")
            self.set_output(content)

            logger.info(f"✅ Loaded skill: {skill_name} size={len(content)}")
        except Exception as exc:
            exception = exc
            raise
        finally:
            await record_tool_call(
                "load_skill",
                output=getattr(self, "_output", None),
                exception=exception,
            )
