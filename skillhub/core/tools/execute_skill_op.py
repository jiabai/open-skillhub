import asyncio
import json
import os
from time import perf_counter
from typing import Any

from flowllm.core.context import C
from flowllm.core.op import BaseAsyncToolOp
from flowllm.core.schema import ToolCall

from skillhub.config.settings import settings
from skillhub.core.metrics.tool_call_metrics import record_tool_call
from skillhub.core.security.rbac import has_permission, is_skill_visible
from skillhub.core.utils.command_whitelist import validate_command
from skillhub.core.utils.skill_storage import get_skill_versions_dir, tool_error_payload
from skillhub.core.utils.user_context import get_current_user_id
from skillhub.db import session as db_session
from skillhub.repositories.audit_log import AuditLogRepository
from skillhub.repositories.skill import SkillRepository
from skillhub.repositories.skill_version import SkillVersionRepository
from skillhub.repositories.user import UserRepository
from skillhub.services.audit import AuditService
from skillhub.services.skill import SkillService

_execution_control: Any = None
_execution_control_mod: Any = None
try:
    from skillhub.core.utils import execution_control as _execution_control_mod
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


def is_within_workdir_quota(path, max_bytes: int | None = None) -> bool:
    if _execution_control is None:
        return True
    return _execution_control.is_within_workdir_quota(path, max_bytes=max_bytes)


def truncate_output(output: str, max_bytes: int | None = None) -> str:
    if _execution_control is None:
        return output
    return _execution_control.truncate_output(output, max_bytes=max_bytes)


def _entrypoint_to_command(entrypoint: str) -> str | None:
    lowered = entrypoint.lower()
    if lowered.endswith(".py"):
        return f"python {entrypoint}"
    if lowered.endswith(".js"):
        return f"node {entrypoint}"
    if lowered.endswith(".sh"):
        return f"bash {entrypoint}"
    return None


@C.register_op()
class ExecuteSkillOp(BaseAsyncToolOp):
    def build_tool_call(self) -> ToolCall:
        return ToolCall(
            **{
                "name": "execute_skill",
                "description": "Execute a skill from enterprise cloud",
                "input_schema": {
                    "skill_uuid": {"type": "string", "description": "Skill UUID", "required": True},
                    "version": {"type": "string", "description": "Skill version", "required": False},
                    "parameters": {"type": "object", "description": "Skill parameters", "required": False},
                },
            },
        )

    def _set_output(self, value: str):
        self._output = value
        self.set_output(value)

    async def async_execute(self):
        exception: Exception | None = None
        release_slot = None
        try:
            self._output = None
            user_id = get_current_user_id()
            if not user_id:
                self._set_output(tool_error_payload("Unauthorized", "UNAUTHORIZED"))
                return
            skill_uuid = self.input_dict["skill_uuid"]
            version_input = self.input_dict.get("version")
            parameters = self.input_dict.get("parameters") or {}
            async for session in db_session.get_async_session():
                skill_repo = SkillRepository(session)
                version_repo = SkillVersionRepository(session)
                user_repo = UserRepository(session)
                user = await user_repo.get_by_id(user_id)
                if not user:
                    self._set_output(tool_error_payload("Unauthorized", "UNAUTHORIZED"))
                    return
                if not has_permission(user, "skill.execute"):
                    self._set_output(tool_error_payload("Permission denied", "PERMISSION_DENIED"))
                    return
                skill = await skill_repo.get_by_id(skill_uuid)
                if not skill or not is_skill_visible(user, skill):
                    self._set_output(tool_error_payload("Skill not found", "SKILL_NOT_FOUND"))
                    return
                if not skill.is_active:
                    self._set_output(tool_error_payload("Skill deactivated", "SKILL_DEACTIVATED"))
                    return
                version = version_input or skill.current_version or ""
                if not version:
                    versions = await version_repo.list_by_skill(skill.id)
                    if versions:
                        version = versions[0].version
                if not version:
                    self._set_output(tool_error_payload("Version not found", "VERSION_NOT_FOUND"))
                    return
                record = await version_repo.get_by_version(skill.id, version)
                if not record:
                    self._set_output(tool_error_payload("Version not found", "VERSION_NOT_FOUND"))
                    return
                version_dir = get_skill_versions_dir(user_id, skill.name) / version
                if settings.ENABLE_RESOURCE_QUOTA and not is_within_workdir_quota(version_dir):
                    self._set_output(tool_error_payload("Work directory quota exceeded", "QUOTA_EXCEEDED"))
                    return
                if settings.ENABLE_RESOURCE_QUOTA:
                    release_slot = await acquire_execution_slot(str(user.id), user.team_id)
                    if release_slot is None:
                        self._set_output(tool_error_payload("Execution concurrency limit exceeded", "CONCURRENCY_LIMIT"))
                        return
                skill_md_path = version_dir / "SKILL.md"
                if not skill_md_path.exists():
                    self._set_output(tool_error_payload("SKILL.md not found", "SKILL_MD_NOT_FOUND"))
                    return
                content = skill_md_path.read_text(encoding="utf-8", errors="replace")
                metadata = SkillService._parse_frontmatter(content)
                command = metadata.get("command")
                if not command:
                    entrypoint = metadata.get("entrypoint")
                    if isinstance(entrypoint, str):
                        command = _entrypoint_to_command(entrypoint)
                if not command or not isinstance(command, str):
                    self._set_output(
                        tool_error_payload("Skill entrypoint not configured", "SKILL_EXECUTION_NOT_CONFIGURED")
                    )
                    return
                is_valid, error_msg = validate_command(command)
                if not is_valid:
                    self._set_output(tool_error_payload(error_msg, "COMMAND_BLOCKED"))
                    return
                env = os.environ.copy()
                if settings.ENABLE_SANDBOX_EXECUTION:
                    env = {"PATH": env.get("PATH", ""), "SKILL_PARAMS": ""}
                env["SKILL_PARAMS"] = json.dumps(parameters, ensure_ascii=False)
                start = perf_counter()
                proc = await asyncio.subprocess.create_subprocess_shell(
                    f"cd {version_dir} && {command}",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=env,
                )
                status = "success"
                timeout_seconds = max(1, int(settings.SKILL_EXECUTION_TIMEOUT_SECONDS))
                try:
                    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout_seconds)
                except asyncio.TimeoutError:
                    proc.kill()
                    stdout, stderr = await proc.communicate()
                    status = "timeout"
                duration_ms = int((perf_counter() - start) * 1000)
                output = truncate_output((stdout.decode(errors="replace") + stderr.decode(errors="replace")).strip())
                if status != "timeout":
                    status = "success" if proc.returncode == 0 else "error"
                if settings.ENABLE_AUDIT_LOG:
                    audit_service = AuditService(AuditLogRepository(session))
                    await audit_service.create_event(
                        actor_id=user.id,
                        action="skill.execute",
                        target=skill.id,
                        result=status,
                        metadata={"version": version, "execution_time_ms": duration_ms},
                    )
                self._set_output(
                    json.dumps(
                        {"result": {"status": status, "output": output, "execution_time_ms": duration_ms}},
                        ensure_ascii=False,
                    )
                )
                return
        except Exception as exc:
            exception = exc
            raise
        finally:
            if release_slot is not None:
                await release_slot()
            await record_tool_call(
                "execute_skill",
                output=getattr(self, "_output", None),
                exception=exception,
            )
