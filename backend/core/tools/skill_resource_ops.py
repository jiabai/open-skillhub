import json
from datetime import datetime, timezone

from flowllm.core.context import C
from flowllm.core.op import BaseAsyncToolOp
from flowllm.core.schema import ToolCall

from backend.config.settings import settings
from backend.core.metrics.tool_call_metrics import record_tool_call
from backend.core.security.rbac import has_permission, is_skill_visible
from backend.core.utils.skill_storage import get_skill_versions_dir, tool_error_payload
from backend.core.utils.user_context import get_current_user_id
from backend.db import session as db_session
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository
from backend.repositories.user import UserRepository
from backend.services.skill import SkillService


def _format_time(value: datetime | None) -> str | None:
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _normalized_visibility(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"private", "team", "enterprise"}:
        return normalized
    default_visibility = str(settings.DEFAULT_SKILL_VISIBILITY or "private").strip().lower()
    if default_visibility in {"private", "team", "enterprise"}:
        return default_visibility
    return "private"


def _deprecation_info() -> dict[str, bool | str | None]:
    deprecated = bool(settings.DEPRECATED_ENDPOINTS or settings.DEPRECATED_VERSIONS)
    sunset = str(settings.DEPRECATED_VERSION_SUNSET_DATE or "").strip() or None
    return {"deprecated": deprecated, "sunset": sunset}


@C.register_op()
class SkillListResourceOp(BaseAsyncToolOp):
    def build_tool_call(self) -> ToolCall:
        return ToolCall(
            **{
                "name": "skill_list_resource",
                "description": "Return MCP skill://list resource payload.",
                "input_schema": {},
            },
        )

    def _set_output(self, value: str):
        self._output = value
        self.set_output(value)

    async def async_execute(self):
        exception: Exception | None = None
        try:
            self._output = None
            user_id = get_current_user_id()
            if not user_id:
                payload = {"contents": [{"uri": "skill://list", "mimeType": "application/json", "text": '{"skills": []}'}]}
                self._set_output(json.dumps(payload, ensure_ascii=False))
                return
            async for session in db_session.get_async_session():
                skill_repo = SkillRepository(session)
                version_repo = SkillVersionRepository(session)
                user_repo = UserRepository(session)
                user = await user_repo.get_by_id(user_id)
                if not user:
                    self._set_output(tool_error_payload("Unauthorized", "UNAUTHORIZED"))
                    return
                if not has_permission(user, "skill.list"):
                    self._set_output(tool_error_payload("Permission denied", "PERMISSION_DENIED"))
                    return
                skills = await skill_repo.list_visible(
                    user.id,
                    user.enterprise_id,
                    user.team_id,
                    include_inactive=False,
                )
                items = []
                for skill in skills:
                    version = skill.current_version
                    if not version:
                        versions = await version_repo.list_by_skill(skill.id)
                        if versions:
                            version = versions[0].version
                    items.append(
                        {
                            "skill_id": skill.id,
                            "name": skill.name,
                            "version": version,
                            "description": skill.description,
                            "author": str(skill.user_id),
                            "visible": _normalized_visibility(skill.visibility),
                            "created_at": _format_time(skill.created_at),
                            "updated_at": _format_time(skill.updated_at),
                            "tags": skill.tags,
                            "deprecation_info": _deprecation_info(),
                        }
                    )
                body = json.dumps({"skills": items}, ensure_ascii=False)
                payload = {"contents": [{"uri": "skill://list", "mimeType": "application/json", "text": body}]}
                self._set_output(json.dumps(payload, ensure_ascii=False))
        except Exception as exc:
            exception = exc
            raise
        finally:
            await record_tool_call(
                "skill_list_resource",
                output=getattr(self, "_output", None),
                exception=exception,
            )


@C.register_op()
class SkillDetailResourceOp(BaseAsyncToolOp):
    def build_tool_call(self) -> ToolCall:
        return ToolCall(
            **{
                "name": "skill_detail_resource",
                "description": "Return MCP skill://{skill_uuid}@{version} resource payload.",
                "input_schema": {
                    "skill_uuid": {"type": "string", "description": "Skill UUID", "required": True},
                    "version": {"type": "string", "description": "Skill version", "required": False},
                },
            },
        )

    def _set_output(self, value: str):
        self._output = value
        self.set_output(value)

    async def async_execute(self):
        exception: Exception | None = None
        try:
            self._output = None
            user_id = get_current_user_id()
            if not user_id:
                self._set_output(tool_error_payload("Unauthorized", "UNAUTHORIZED"))
                return
            skill_id = self.input_dict["skill_uuid"]
            version_input = self.input_dict.get("version")
            async for session in db_session.get_async_session():
                skill_repo = SkillRepository(session)
                version_repo = SkillVersionRepository(session)
                user_repo = UserRepository(session)
                user = await user_repo.get_by_id(user_id)
                if not user:
                    self._set_output(tool_error_payload("Unauthorized", "UNAUTHORIZED"))
                    return
                if not has_permission(user, "skill.read"):
                    self._set_output(tool_error_payload("Permission denied", "PERMISSION_DENIED"))
                    return
                skill = await skill_repo.get_by_id(skill_id)
                if not skill or not is_skill_visible(user, skill):
                    self._set_output(tool_error_payload("Skill not found", "SKILL_NOT_FOUND"))
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
                skill_md_path = version_dir / "SKILL.md"
                metadata = {}
                if skill_md_path.exists():
                    content = skill_md_path.read_text(encoding="utf-8", errors="replace")
                    metadata = SkillService._parse_frontmatter(content)
                parameters = metadata.get("parameters")
                if isinstance(parameters, str):
                    try:
                        parameters = json.loads(parameters)
                    except Exception:
                        parameters = None
                detail = {
                    "skill_id": skill.id,
                    "version": version,
                    "name": metadata.get("name") or skill.name,
                    "description": metadata.get("description") or skill.description,
                    "author": str(skill.user_id),
                    "parameters": parameters,
                    "dependencies": list(record.dependencies or []),
                    "visible": _normalized_visibility(skill.visibility),
                    "created_at": _format_time(skill.created_at),
                    "updated_at": _format_time(skill.updated_at),
                    "dependency_spec": record.dependency_spec or None,
                }
                body = json.dumps(detail, ensure_ascii=False)
                payload = {
                    "contents": [
                        {
                            "uri": f"skill://{skill.id}@{version}",
                            "mimeType": "application/json",
                            "text": body,
                        }
                    ]
                }
                self._set_output(json.dumps(payload, ensure_ascii=False))
                return
        except Exception as exc:
            exception = exc
            raise
        finally:
            await record_tool_call(
                "skill_detail_resource",
                output=getattr(self, "_output", None),
                exception=exception,
            )
