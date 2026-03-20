"""Operation for reading reference files from skills.

This module provides the ReadReferenceFileOp class which allows reading
reference files (e.g., forms.md, reference.md, ooxml.md) from skill directories.
The skill directory is read from {service_config.metadata["skill_dir"]} /
{skill_name}. If the file is not found, an error message is returned.
"""

from pathlib import Path

from loguru import logger

from flowllm.core.context import C
from flowllm.core.op import BaseAsyncToolOp
from flowllm.core.schema import ToolCall

from skillhub.core.metrics.tool_call_metrics import record_tool_call
from skillhub.core.utils.skill_storage import tool_error_payload, validate_file_path, validate_skill_name
from skillhub.core.utils.user_context import get_current_user_id


async def _is_skill_active(skill_name: str, user_id: str | None) -> bool:
    if not user_id:
        return True
    try:
        from skillhub.db.session import get_async_session
        from skillhub.repositories.skill import SkillRepository
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
class ReadReferenceFileOp(BaseAsyncToolOp):
    """Operation for reading reference files from a skill directory.

    This tool allows reading reference files like forms.md, reference.md,
    or ooxml.md from a specific skill's directory. The skill directory is
    read from {service_config.metadata["skill_dir"]} / {skill_name}.

    The tool:
    1. Takes a skill_name and file_name as input
    2. Gets the skill directory from {service_config.metadata["skill_dir"]}/{skill_name}
    3. Constructs the file path as {skill_dir}/{file_name}
    4. Reads the file content if it exists
    5. Returns the file content or an error message if not found

    Returns:
        str: The content of the reference file read from the skill directory.
            If the file is not found, returns an error message string indicating
            that the file was not found in the specified skill.

    Note:
        - The skill_name must exist in `C.service_config.metadata["skill_dir"]`
        - The file_name can be a simple filename (e.g., "reference.md") or a
          relative path within the skill directory
        - File encoding is assumed to be UTF-8
        - The file path is constructed as: {skill_dir}/{file_name}
    """

    def build_tool_call(self) -> ToolCall:
        """Build the tool call definition for read_reference_file.

        Creates and returns a ToolCall object that defines the read_reference_file
        tool. This tool requires both skill_name and file_name parameters to
        identify which reference file to read from which skill.

        Returns:
            ToolCall: A ToolCall object defining the read_reference_file tool with
                the following properties:
                - name: "read_reference_file"
                - description: Description of what the tool does
                - input_schema: A schema requiring:
                    - "skill_name" (string, required): The name of the skill
                    - "file_name" (string, required): The reference file name or
                      file path relative to the skill directory
        """
        return ToolCall(
            **{
                "name": "read_reference_file",
                "description": "Read a reference file from a skill (e.g., forms.md, reference.md, ooxml.md)",
                "input_schema": {
                    "skill_name": {
                        "type": "string",
                        "description": "skill name",
                        "required": True,
                    },
                    "file_name": {
                        "type": "string",
                        "description": "reference file name or file path",
                        "required": True,
                    },
                },
            },
        )

    async def async_execute(self):
        """Execute the read reference file operation.

        Reads a reference file from the specified skill directory. The method
        gets the skill directory from {service_config.metadata["skill_dir"]} /
        {skill_name}, constructs the file path, and reads the file content if it
        exists.

        The method:
        1. Extracts the skill_name and file_name from input_dict
        2. Gets the skill directory from {service_config.metadata["skill_dir"]} / {skill_name}
        3. Constructs the file path as {skill_dir}/{file_name}
        4. Checks if the file exists
        5. Reads the file content if it exists
        6. Returns the file content or an error message if not found

        Returns:
            None: The result is set via `self.set_output()` with one of:
                - The file content (as a string) if the file exists
                - An error message string if the file is not found

        Raises:
            KeyError: If skill_name is not found in the skill directory.
                Remember to call LoadSkillMetadataOp before LoadSkillOp and get the available skills.

        Note:
            - The file path is constructed as: {skill_dir}/{file_name}
            - File encoding is assumed to be UTF-8
            - If the file does not exist, an error message is returned instead
              of raising an exception
        """
        exception: Exception | None = None
        try:
            skill_name = self.input_dict["skill_name"]
            file_name = self.input_dict["file_name"]
            valid, error = validate_skill_name(skill_name)
            if not valid:
                self.set_output(tool_error_payload(error, "INVALID_SKILL_NAME"))
                return
            valid, error = validate_file_path(file_name)
            if not valid:
                self.set_output(tool_error_payload(error, "INVALID_FILE_PATH"))
                return
            skill_dir = Path(C.service_config.metadata["skill_dir"]).resolve()
            user_id = get_current_user_id()
            logger.info(
                f"🔧 Tool called: read_reference_file(skill_name='{skill_name}', file_name='{file_name}') "
                f"with skill_dir={skill_dir}",
            )
            if not await _is_skill_active(skill_name, user_id):
                payload = {"skill_name": skill_name, "message": "Skill deactivated"}
                self.set_output(tool_error_payload(payload, "SKILL_DEACTIVATED"))
                return

            file_path = skill_dir / user_id / skill_name / file_name if user_id else skill_dir / skill_name / file_name
            if not file_path.exists():
                payload = {"skill_name": skill_name, "file_name": file_name, "message": "File not found"}
                logger.exception(payload)
                self.set_output(tool_error_payload(payload, "FILE_NOT_FOUND"))
                return

            result = file_path.read_text(encoding="utf-8")
            logger.info(f"✅ Read file: {skill_name}/{file_name} size={len(result)}")
            self.set_output(result)
        except Exception as exc:
            exception = exc
            raise
        finally:
            await record_tool_call(
                "read_reference_file",
                output=getattr(self, "_output", None),
                exception=exception,
            )
