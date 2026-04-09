"""Operation for running shell commands.

This module provides the RunShellCommandOp class which executes shell
commands in a subprocess, with optional uv-based dependency setup for
Python skills. The command is executed in the skill's
directory context, allowing scripts to access skill-specific files and
resources.
"""

import asyncio
import os
from pathlib import Path
from typing import Any

from loguru import logger

from flowllm.core.context import C
from flowllm.core.op import BaseAsyncToolOp
from flowllm.core.schema import ToolCall

from backend.config.settings import settings
from backend.core.metrics.tool_call_metrics import record_tool_call
from backend.core.utils.command_whitelist import get_command_policy
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


_SAFE_ENV_KEYS = {
    "PATH",
    "HOME",
    "USERPROFILE",
    "TMP",
    "TEMP",
    "SYSTEMROOT",
    "WINDIR",
    "COMSPEC",
    "PATHEXT",
    "LANG",
    "LC_ALL",
    "PYTHONIOENCODING",
    "PYTHONUTF8",
}


def _build_subprocess_env(work_dir: Path | None = None) -> dict[str, str]:
    env: dict[str, str] = {}
    for key in _SAFE_ENV_KEYS:
        value = os.environ.get(key)
        if value:
            env[key] = value
    env.setdefault("PYTHONIOENCODING", "utf-8")
    env.setdefault("PYTHONUTF8", "1")
    if work_dir is not None:
        env.setdefault("UV_PROJECT_ENVIRONMENT", str(work_dir / ".venv"))
    return env


async def _run_process(command_args: list[str], work_dir: Path) -> tuple[int, bytes, bytes]:
    proc = await asyncio.create_subprocess_exec(
        *command_args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(work_dir),
        env=_build_subprocess_env(work_dir),
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode, stdout, stderr


async def _install_python_dependencies_with_uv(work_dir: Path) -> None:
    command_args: list[str] | None = None
    if (work_dir / "pyproject.toml").exists():
        command_args = ["uv", "sync"]
    elif (work_dir / "requirements.txt").exists():
        command_args = ["uv", "pip", "install", "-r", "requirements.txt"]
    if command_args is None:
        logger.info("No uv dependency manifest found, skipping dependency auto-install.")
        return
    returncode, stdout, stderr = await _run_process(command_args, work_dir)
    if returncode != 0:
        logger.warning(f"Failed to install dependencies with uv:\n{stdout.decode()}\n{stderr.decode()}")
        return
    logger.info(f"Dependencies installed successfully with uv.\n{stdout.decode()}\n{stderr.decode()}")


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

    This tool executes shell commands and can optionally prepare uv-managed
    Python dependencies before execution. The command is executed in the
    skill's directory context, allowing scripts to access skill-specific
    files and resources.

    The operation will:
    1. Extract skill_name and command from input
    2. Get the skill directory from {service_config.metadata["skill_dir"]} / {skill_name}
    3. Change to the skill directory before executing the command
    4. For Python commands, optionally install dependencies with uv
    5. Execute the command in a subprocess and capture stdout/stderr
    6. Return the combined output
    """

    file_path: str = __file__

    def __init__(self, auto_install_deps: bool = False, **kwargs):
        super().__init__(**kwargs)
        self.auto_install_deps: bool = auto_install_deps

    def build_tool_call(self) -> ToolCall:
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
            logger.info(f"run shell command: skill_name={skill_name} skill_dir={skill_dir} command={command}")
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

            policy, error_msg = get_command_policy(command)
            if policy is None:
                self.set_output(tool_error_payload(error_msg, "COMMAND_BLOCKED"))
                return
            try:
                command_args = split_command_args(command)
            except ValueError as exc:
                self.set_output(tool_error_payload(str(exc), "COMMAND_BLOCKED"))
                return
            logger.debug(f"run_shell_command policy={policy.category} command={command}")

            if self.auto_install_deps:
                is_python_command = any(token in command_args for token in ("python", "python3", "uv"))
                if is_python_command:
                    await _install_python_dependencies_with_uv(work_dir)

            proc = await asyncio.create_subprocess_exec(
                *command_args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(work_dir),
                env=_build_subprocess_env(work_dir),
            )

            timeout_seconds = max(1, int(settings.SKILL_EXECUTION_TIMEOUT_SECONDS))
            try:
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout_seconds)
            except asyncio.TimeoutError:
                proc.kill()
                stdout, stderr = await proc.communicate()
            output = truncate_output(stdout.decode().strip() + "\n" + stderr.decode().strip())
            logger.info(f"Command executed: skill_name={skill_name} output={output}")
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
