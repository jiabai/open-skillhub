"""Operation for loading skill metadata.

This module provides the LoadSkillMetadataOp class which scans the skills
directory recursively and extracts metadata (name and description) from all
SKILL.md files. The metadata is parsed from YAML frontmatter in each SKILL.md
file and returned a string in the format:
    ```
    Available skills (each line is "- <skill_name>: <skill_description>"):\n
    - <skill_name_1>: <skill_description_1>\n
    - <skill_name_2>: <skill_description_2>\n
    ...
    - <skill_name_n>: <skill_description_n>\n
    ```
This string can be used to display all available skills.
"""

from pathlib import Path

from loguru import logger

from flowllm.core.context import C
from flowllm.core.op import BaseAsyncToolOp
from flowllm.core.schema import ToolCall

from skillhub.core.metrics.tool_call_metrics import record_tool_call
from skillhub.core.utils.user_context import get_current_user_id


@C.register_op()
class LoadSkillMetadataOp(BaseAsyncToolOp):
    """Operation for loading metadata from all available skills.

    This tool scans the skills directory recursively for SKILL.md files and
    extracts their metadata (name and description) from YAML frontmatter.
    The metadata is returned as a dictionary where keys are skill names and
    values contain the description and skill directory path.

    Returns:
        str: A string containing the skill metadata in the format:
            ```
            Available skills (each line is "- <skill_name>: <skill_description>"):\n
            - <skill_name_1>: <skill_description_1>\n
            - <skill_name_2>: <skill_description_2>\n
            ...
            - <skill_name_n>: <skill_description_n>\n
            ```

    Note:
        The skills directory path is obtained from `self.context.skill_dir`.
        Only SKILL.md files with valid YAML frontmatter containing both 'name'
        and 'description' fields will be included in the results.
    """

    def build_tool_call(self) -> ToolCall:
        """Build the tool call definition for load_skill_metadata.

        Creates and returns a ToolCall object that defines the load_skill_metadata
        tool. This tool requires no input parameters and will scan the skills
        directory to load all available skill metadata.

        Returns:
            ToolCall: A ToolCall object defining the load_skill_metadata tool
                with the following properties:
                - name: "load_skill_metadata"
                - description: Description of what the tool does
                - input_schema: Empty dict (no input parameters required)
        """
        tool_params = {
            "name": "load_skill_metadata",
            "description": "Load metadata (name and description) for all available skills from the skills directory.",
            "input_schema": {},
        }
        return ToolCall(**tool_params)

    @staticmethod
    async def parse_skill_metadata(content: str, path: str) -> dict[str, str] | None:
        """Extract skill metadata (name and description) from SKILL.md content.

        Parses YAML frontmatter from SKILL.md files to extract the skill name
        and description. The frontmatter should be in the format:
        ```
        ---
        name: skill_name
        description: skill description
        ---
        ```

        The method splits the content by "---" delimiters to extract the
        frontmatter section, then parses each line to find the 'name' and
        'description' fields. Values can be quoted or unquoted.

        Args:
            content: The full content of the SKILL.md file as a string.
            path: The file path (used for logging purposes when parsing fails).

        Returns:
            dict[str, str] | None: A dictionary with 'name' and 'description'
                keys containing the extracted values, or None if:
                - No YAML frontmatter is found (less than 3 parts after splitting)
                - The 'name' field is missing or empty
                - The 'description' field is missing or empty
        """
        # Split content by YAML frontmatter delimiters (---)
        # Expected format: "---\n...frontmatter...\n---\n...content..."
        # This should result in at least 3 parts: [before, frontmatter, after]
        parts = content.split("---")
        if len(parts) < 3:
            logger.warning(f"No YAML frontmatter found in skill from {path}")
            return None

        # Extract the frontmatter section (between the first two "---" delimiters)
        frontmatter_text = parts[1].strip()
        name = None
        description = None

        # Parse each line in the frontmatter to find name and description
        for line in frontmatter_text.split("\n"):
            line = line.strip()
            if line.startswith("name:"):
                # Extract value after "name:", remove quotes if present
                name = line.split(":", 1)[1].strip().strip("\"'")
            elif line.startswith("description:"):
                # Extract value after "description:", remove quotes if present
                description = line.split(":", 1)[1].strip().strip("\"'")

        # Validate that both required fields are present
        if not name or not description:
            logger.warning(f"Missing name or description in skill from {path}")
            return None

        return {
            "name": name,
            "description": description,
        }

    async def async_execute(self):
        """Execute the load skill metadata operation.

        Scans the skills directory recursively for all SKILL.md files,
        extracts their metadata from YAML frontmatter, and constructs
        a string to display the name and descriptions of all available skills.

        The method:
        1. Gets the skills directory path from the service_config
        2. Recursively searches for all SKILL.md files
        3. Parses each file's frontmatter to extract metadata
        4. Builds a string with skill names and their descriptions
        5. Sets the output with the complete metadata string

        Returns:
            None: The result is set via `self.set_output()` with a string
                in the format:
                "Available skills (each line is "- <skill_name>: <skill_description>"):\n
                - <skill_name_1>: <skill_description_1>\n
                - <skill_name_2>: <skill_description_2>\n
                ...
                - <skill_name_n>: <skill_description_n>\n"

        Note:
            Only skills with valid metadata (both name and description) are
            included in the result. Invalid or missing metadata is logged as
            a warning but does not stop the process.
        """
        exception: Exception | None = None
        try:
            skill_dir = Path(C.service_config.metadata["skill_dir"]).resolve()
            user_id = get_current_user_id()
            search_dir = skill_dir / user_id if user_id else skill_dir
            logger.info(f"🔧 Tool called: load_skill_metadata(path={search_dir})")

            skill_files = list(search_dir.rglob("SKILL.md"))

            skill_num = 0
            skill_metadata_context = 'Available skills (each line is "- <skill_name>: <skill_description>"):'
            for skill_file in skill_files:
                content = skill_file.read_text(encoding="utf-8")
                metadata = await self.parse_skill_metadata(content, str(skill_file))

                if metadata:
                    skill_num += 1
                    skill_dir = skill_file.parent.as_posix()
                    name = metadata["name"]
                    description = metadata["description"]
                    skill_metadata_context += f"\n- {name}: {description}"
                    logger.info(f"✅ Loaded skill {name} metadata skill_dir={skill_dir}")

            logger.info(f"✅ Loaded {skill_num} skill metadata entries")
            self.set_output(skill_metadata_context)
        except Exception as exc:
            exception = exc
            raise
        finally:
            await record_tool_call(
                "load_skill_metadata",
                output=getattr(self, "_output", None),
                exception=exception,
            )
