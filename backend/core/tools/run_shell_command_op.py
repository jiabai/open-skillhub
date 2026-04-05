"""Operation for running shell commands.

This module provides the RunShellCommandOp class which executes shell
commands in a subprocess, with automatic dependency detection and
installation for script files. The command is executed in the skill's
directory context, allowing scripts to access skill-specific files and
resources.
"""

import asyncio
import os
import shutil
from pathlib import Path
from typing import Any

from loguru import logger

from flowllm.core.context import C
from flowllm.core.op import BaseAsyncToolOp
from flowllm.core.schema import ToolCall

from backend.config.settings import settings
from backend.core.metrics.tool_call_metrics import record_tool_call
from backend.core.utils.command_whitelist import validate_command
from backend.core.utils.process_exec import split_command_args
from backend.core.utils.skill_storage import tool_error_payload, validate_skill_name
from backend.core.utils.user_context import get_current_user_id

_execution_control: Any = None
_execution_control_mod: Any = None
try:
    from backend.core.utils import execution_control as _execution_control_mod
except Exception:
    pass
if _execution_control_mod is not None:
    _execution_control = _execution_control_mod


async def acquire_execution_slot(user_id: str, team_id: str | None):
    if _execution_control is None:
        async def _release():
            return None

        return _release
    return await _execution_control.acquire_execution_slot(user_id, team_id)


def is_within_workdir_quota(path: Path, max_bytes: int | None = None) -> bool:
    if _execution_control is None:
        return True
    return _execution_control.is_within_workdir_quota(path, max_bytes=max_bytes)


def truncate_output(output: str, max_bytes: int | None = None) -> str:
    if _execution_control is None:
        return output
    return _execution_control.truncate_output(output, max_bytes=max_bytes)


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
class RunShellCommandOp(BaseAsyncToolOp):
    """Operation for running shell commands in a subprocess.

    This tool executes shell commands and can automatically detect and
    install dependencies for script files (Python, JavaScript, Shell).
    The command is executed in the skill's directory context, allowing
    scripts to access skill-specific files and resources.

    The operation will:
    1. Extract skill_name and command from input
    2. Get the skill directory from {service_config.metadata["skill_dir"]} / {skill_name}
    3. Change to the skill directory before executing the command
    4. For Python commands, automatically detect and install dependencies
       using pipreqs (if available and auto_install_deps parameter is enabled)
    5. Execute the command in a subprocess and capture stdout/stderr
    6. Return the combined output

    Returns:
        str: The combined stdout and stderr output from the command execution.
            The output is decoded as UTF-8 and stripped of leading/trailing
            whitespace, with stdout and stderr concatenated with a newline.

    Note:
        - The skill_name must exist in `C.service_config.metadata["skill_dir"]`
        - The command is executed in the skill's directory using `cd {skill_dir}/{skill_name} && {command}`
        - For Python commands (containing "py"), the tool attempts to auto-install
          dependencies using pipreqs if it's available in the system PATH and
          the auto_install_deps parameter is enabled
        - If pipreqs is not available or dependency installation fails, a warning
          is logged but the command execution continues
        - The subprocess uses the current environment variables (os.environ.copy())
    """

    file_path: str = __file__

    def __init__(self, auto_install_deps: bool = False, **kwargs):
        """Initialize RunShellCommandOp.

        Args:
            auto_install_deps: If True, enables automatic dependency installation for Python
                commands. Defaults to False.
            **kwargs: Additional keyword arguments passed to parent class.
        """
        super().__init__(**kwargs)
        self.auto_install_deps: bool = auto_install_deps

    def build_tool_call(self) -> ToolCall:
        """Build the tool call definition for run_shell_command.

        Creates and returns a ToolCall object that defines the run_shell_command
        tool. This tool requires both skill_name and command parameters to
        identify which skill directory to use and what command to execute.

        Returns:
            ToolCall: A ToolCall object defining the run_shell_command tool with
                the following properties:
                - name: "run_shell_command"
                - description: Description of what the tool does
                - input_schema: A schema requiring:
                    - "skill_name" (string, required): The name of the skill
                    - "command" (string, required): The shell command to execute
        """
        return ToolCall(
            **{
                "name": "run_shell_command",
                "description": self.get_prompt("tool_desc").format(
                    skill_dir=Path(C.service_config.metadata["skill_dir"]).resolve(),
                ),
                "input_schema": {
                    "skill_name": {
                        "type": "string",
                        "description": "skill name",
                        "required": True,
                    },
                    "command": {
                        "type": "string",
                        "description": "shell command",
                        "required": True,
                    },
                },
            },
        )

    async def async_execute(self):
        """Execute the shell command operation.

        Executes a shell command in the specified skill's directory. For Python
        commands, the method attempts to automatically detect and install
        dependencies using pipreqs before executing the command.

        The method:
        1. Extracts skill_name and command from input_dict
        2. Looks up the skill directory from skill_metadata_dict
        3. For Python commands (containing "py"), checks if pipreqs is available
        4. If pipreqs is available, generates requirements.txt and installs dependencies
        5. Constructs the full command as `cd {skill_dir} && {command}`
        6. Executes the command in a subprocess with the current environment
        7. Captures stdout and stderr output
        8. Returns the combined output (stdout + stderr)

        Returns:
            None: The result is set via `self.set_output()` with the combined
                stdout and stderr output from the command execution. The output
                is decoded as UTF-8 and formatted as: "{stdout}\n{stderr}"

        Raises:
            KeyError: If skill_name is not found in skill_metadata_dict.
                This should be handled by ensuring LoadSkillMetadataOp is
                called before RunShellCommandOp.

        Note:
            - Dependency auto-installation only occurs for commands containing "py"
              and when the auto_install_deps parameter is enabled
            - If pipreqs is not available, a warning is logged but execution continues
            - If dependency installation fails, a warning is logged but the command
              is still executed
            - The command runs in the skill's directory, allowing access to
              skill-specific files and resources
            - Environment variables from the current process are passed to the subprocess
        """
        exception: Exception | None = None
        release_slot = None
        try:
            skill_name = self.input_dict["skill_name"]
            command: str = self.input_dict["command"]
            valid, error = validate_skill_name(skill_name)
            if not valid:
                self.set_output(tool_error_payload(error, "INVALID_SKILL_NAME"))
                return

            skill_dir = Path(C.service_config.metadata["skill_dir"]).resolve()
            user_id = get_current_user_id()
            if not await _is_skill_active(skill_name, user_id):
                payload = {"skill_name": skill_name, "message": "Skill deactivated"}
                self.set_output(tool_error_payload(payload, "SKILL_DEACTIVATED"))
                return
            work_dir = skill_dir / user_id / skill_name if user_id else skill_dir / skill_name
            logger.info(f"🔧 run shell command: skill_name={skill_name} skill_dir={skill_dir} command={command}")
            if not work_dir.exists():
                self.set_output(
                    tool_error_payload(
                        {"skill_name": skill_name, "message": "Skill directory not found"},
                        "SKILL_DIR_NOT_FOUND",
                    ),
                )
                return
            if settings.ENABLE_RESOURCE_QUOTA and not is_within_workdir_quota(work_dir):
                self.set_output(tool_error_payload("Work directory quota exceeded", "QUOTA_EXCEEDED"))
                return
            if settings.ENABLE_RESOURCE_QUOTA:
                release_slot = await acquire_execution_slot(user_id or "anonymous", None)
                if release_slot is None:
                    self.set_output(tool_error_payload("Execution concurrency limit exceeded", "CONCURRENCY_LIMIT"))
                    return

            is_valid, error_msg = validate_command(command)
            if not is_valid:
                self.set_output(tool_error_payload(error_msg, "COMMAND_BLOCKED"))
                return
            try:
                command_args = split_command_args(command)
            except ValueError as exc:
                self.set_output(tool_error_payload(str(exc), "COMMAND_BLOCKED"))
                return

            if self.auto_install_deps:
                if "py" in command:
                    pipreqs_available = shutil.which("pipreqs") is not None
                    if pipreqs_available:
                        proc = await asyncio.create_subprocess_exec(
                            "pipreqs",
                            ".",
                            "--force",
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                            cwd=str(work_dir),
                        )
                        stdout, stderr = await proc.communicate()
                        if proc.returncode == 0:
                            proc = await asyncio.create_subprocess_exec(
                                "pip",
                                "install",
                                "-r",
                                "requirements.txt",
                                stdout=asyncio.subprocess.PIPE,
                                stderr=asyncio.subprocess.PIPE,
                                cwd=str(work_dir),
                            )
                            stdout, stderr = await proc.communicate()
                        if proc.returncode != 0:
                            logger.warning(f"⚠️ Failed to install dependencies:\n{stdout.decode()}\n{stderr.decode()}")
                        else:
                            logger.info(f"✅ Dependencies installed successfully.\n{stdout.decode()}\n{stderr.decode()}")
                    else:
                        logger.info("❗️ pipreqs not found, skipping dependency auto-install.")

            proc = await asyncio.create_subprocess_exec(
                *command_args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(work_dir),
                env={"PATH": os.environ.get("PATH", "")} if settings.ENABLE_SANDBOX_EXECUTION else os.environ.copy(),
            )

            timeout_seconds = max(1, int(settings.SKILL_EXECUTION_TIMEOUT_SECONDS))
            try:
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout_seconds)
            except asyncio.TimeoutError:
                proc.kill()
                stdout, stderr = await proc.communicate()
            output = truncate_output(stdout.decode().strip() + "\n" + stderr.decode().strip())
            logger.info(f"✅ Command executed: skill_name={skill_name} output={output}")
            self.set_output(output)
            self._output = output
        except Exception as exc:
            exception = exc
            raise
        finally:
            if release_slot is not None:
                await release_slot()
            await record_tool_call(
                "run_shell_command",
                output=getattr(self, "_output", None),
                exception=exception,
            )
