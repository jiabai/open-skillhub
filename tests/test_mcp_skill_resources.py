import json
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest
from sqlalchemy import select

from backend.config.settings import settings
from backend.core.security.jwt_utils import create_access_token
from backend.core.utils.user_context import set_current_user_id
from backend.core.utils.skill_storage import get_skill_versions_dir, get_user_skill_dir
from backend.models.audit_log import AuditLog
from backend.models.skill import Skill
from backend.models.skill_version import SkillVersion
from backend.models.user import User


def _install_flowllm_stubs(skill_dir: Path, monkeypatch):
    flowllm_module = ModuleType("flowllm")
    flowllm_core = ModuleType("flowllm.core")
    flowllm_context: Any = ModuleType("flowllm.core.context")
    flowllm_op: Any = ModuleType("flowllm.core.op")
    flowllm_schema: Any = ModuleType("flowllm.core.schema")

    class ServiceConfig:
        def __init__(self, dir_path: Path):
            self.metadata = {"skill_dir": str(dir_path)}

    class Context:
        def __init__(self, dir_path: Path):
            self.service_config = ServiceConfig(dir_path)

        def register_op(self):
            def decorator(cls):
                return cls

            return decorator

    class BaseAsyncToolOp:
        def __init__(self, **_kwargs):
            self.input_dict = {}
            self._output = None

        def set_output(self, output):
            self._output = output

    class ToolCall(dict):
        def __init__(self, **kwargs):
            super().__init__(**kwargs)

    flowllm_context.C = Context(skill_dir)
    flowllm_op.BaseAsyncToolOp = BaseAsyncToolOp
    flowllm_schema.ToolCall = ToolCall

    monkeypatch.setitem(sys.modules, "flowllm", flowllm_module)
    monkeypatch.setitem(sys.modules, "flowllm.core", flowllm_core)
    monkeypatch.setitem(sys.modules, "flowllm.core.context", flowllm_context)
    monkeypatch.setitem(sys.modules, "flowllm.core.op", flowllm_op)
    monkeypatch.setitem(sys.modules, "flowllm.core.schema", flowllm_schema)

    return flowllm_context.C


async def _override_session(async_session):
    yield async_session


@pytest.mark.asyncio
async def test_skill_resource_ops_return_metadata(async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    _install_flowllm_stubs(tmp_path, monkeypatch)
    from backend.db import session as db_session

    monkeypatch.setattr(db_session, "get_async_session", lambda: _override_session(async_session))
    user = User(
        email="res@example.com",
        username="res",
        hashed_password="x",
        enterprise_id="ent-res",
        team_id="team-res",
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    skill = Skill(
        user_id=user.id,
        name="skillres",
        description="desc",
        tags=["mcp"],
        visibility="team",
        enterprise_id="ent-res",
        team_id="team-res",
        skill_dir=str(get_user_skill_dir(user.id, "skillres")),
        current_version="1.0.0",
    )
    async_session.add(skill)
    await async_session.commit()
    await async_session.refresh(skill)
    version = SkillVersion(
        skill_id=skill.id,
        version="1.0.0",
        description="desc",
        dependencies=["pydantic"],
        dependency_spec={"schema_version": 1, "python": {"manager": "pip", "requirements": ["pydantic"], "files": []}},
        dependency_spec_version="1",
        metadata_json={"name": "skillres", "description": "desc", "version": "1.0.0"},
    )
    async_session.add(version)
    await async_session.commit()
    base_dir = get_skill_versions_dir(user.id, skill.name)
    version_dir = base_dir / "1.0.0"
    version_dir.mkdir(parents=True, exist_ok=True)
    skill_md = (
        "---\n"
        "name: skillres\n"
        "description: desc\n"
        "parameters:\n"
        "  type: object\n"
        "  properties:\n"
        "    q:\n"
        "      type: string\n"
        "  required:\n"
        "    - q\n"
        "---\n"
        "body"
    )
    (version_dir / "SKILL.md").write_text(skill_md, encoding="utf-8")
    set_current_user_id(str(user.id))
    from backend.core.tools.skill_resource_ops import SkillDetailResourceOp, SkillListResourceOp

    list_op = SkillListResourceOp()
    await list_op.async_execute()
    list_payload = json.loads(list_op._output)
    skills = json.loads(list_payload["contents"][0]["text"])["skills"]
    assert skills[0]["skill_id"] == skill.id
    assert skills[0]["version"] == "1.0.0"
    assert skills[0]["visible"] == "team"
    assert skills[0]["deprecation_info"] == {"deprecated": False, "sunset": None}
    detail_op = SkillDetailResourceOp()
    detail_op.input_dict = {"skill_uuid": skill.id, "version": "1.0.0"}
    await detail_op.async_execute()
    detail_payload = json.loads(detail_op._output)
    detail = json.loads(detail_payload["contents"][0]["text"])
    assert detail["skill_id"] == skill.id
    assert detail["dependencies"] == ["pydantic"]
    assert detail["parameters"]["required"] == ["q"]


@pytest.mark.asyncio
async def test_skill_list_resource_normalizes_visible_field(async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    _install_flowllm_stubs(tmp_path, monkeypatch)
    from backend.db import session as db_session

    monkeypatch.setattr(db_session, "get_async_session", lambda: _override_session(async_session))
    user = User(
        email="vis@example.com",
        username="vis",
        hashed_password="x",
        enterprise_id="ent-vis",
        team_id="team-vis",
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    skill = Skill(
        user_id=user.id,
        name="skillvis",
        description="desc",
        tags=["mcp"],
        visibility="TEAM",
        enterprise_id="ent-vis",
        team_id="team-vis",
        skill_dir=str(get_user_skill_dir(user.id, "skillvis")),
        current_version="1.0.0",
    )
    async_session.add(skill)
    await async_session.commit()
    set_current_user_id(str(user.id))
    from backend.core.tools.skill_resource_ops import SkillListResourceOp

    list_op = SkillListResourceOp()
    await list_op.async_execute()
    list_payload = json.loads(list_op._output)
    skills = json.loads(list_payload["contents"][0]["text"])["skills"]
    assert skills[0]["visible"] == "team"
    assert skills[0]["deprecation_info"] == {"deprecated": False, "sunset": None}


@pytest.mark.asyncio
async def test_execute_skill_runs_entrypoint(async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    _install_flowllm_stubs(tmp_path, monkeypatch)
    from backend.db import session as db_session

    monkeypatch.setattr(db_session, "get_async_session", lambda: _override_session(async_session))
    user = User(email="exec@example.com", username="exec", hashed_password="x")
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    skill = Skill(
        user_id=user.id,
        name="skillexec",
        description="desc",
        tags=[],
        skill_dir=str(get_user_skill_dir(user.id, "skillexec")),
        current_version="1.0.0",
    )
    async_session.add(skill)
    await async_session.commit()
    await async_session.refresh(skill)
    version = SkillVersion(
        skill_id=skill.id,
        version="1.0.0",
        description="desc",
        dependencies=[],
        dependency_spec={"schema_version": 1},
        dependency_spec_version="1",
        metadata_json={"name": "skillexec", "description": "desc", "version": "1.0.0"},
    )
    async_session.add(version)
    await async_session.commit()
    version_dir = get_skill_versions_dir(user.id, skill.name) / "1.0.0"
    version_dir.mkdir(parents=True, exist_ok=True)
    (version_dir / "run.py").write_text(
        "import os\nprint(os.environ.get('SKILL_PARAMS', ''))\n",
        encoding="utf-8",
    )
    skill_md = "---\nname: skillexec\ndescription: desc\nentrypoint: run.py\n---\nbody"
    (version_dir / "SKILL.md").write_text(skill_md, encoding="utf-8")
    set_current_user_id(str(user.id))
    from backend.core.tools.execute_skill_op import ExecuteSkillOp

    op = ExecuteSkillOp()
    op.input_dict = {"skill_uuid": skill.id, "version": "1.0.0", "parameters": {"foo": "bar"}}
    await op.async_execute()
    payload = json.loads(op._output)
    assert payload["result"]["status"] == "success"
    assert '"foo": "bar"' in payload["result"]["output"]
    result = await async_session.execute(
        select(AuditLog).where(
            AuditLog.actor_id == user.id,
            AuditLog.action == "skill.execute",
            AuditLog.target == skill.id,
        )
    )
    assert result.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_execute_skill_blocks_package_manager_entrypoint(async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    _install_flowllm_stubs(tmp_path, monkeypatch)
    from backend.db import session as db_session

    monkeypatch.setattr(db_session, "get_async_session", lambda: _override_session(async_session))
    user = User(email="pkg@example.com", username="pkg", hashed_password="x")
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    skill = Skill(
        user_id=user.id,
        name="skillpkg",
        description="desc",
        tags=[],
        skill_dir=str(get_user_skill_dir(user.id, "skillpkg")),
        current_version="1.0.0",
    )
    async_session.add(skill)
    await async_session.commit()
    await async_session.refresh(skill)
    version = SkillVersion(
        skill_id=skill.id,
        version="1.0.0",
        description="desc",
        dependencies=[],
        dependency_spec={"schema_version": 1},
        dependency_spec_version="1",
        metadata_json={"name": "skillpkg", "description": "desc", "version": "1.0.0"},
    )
    async_session.add(version)
    await async_session.commit()
    version_dir = get_skill_versions_dir(user.id, skill.name) / "1.0.0"
    version_dir.mkdir(parents=True, exist_ok=True)
    (version_dir / "SKILL.md").write_text(
        "---\nname: skillpkg\ndescription: desc\ncommand: pip install requests\n---\nbody",
        encoding="utf-8",
    )
    set_current_user_id(str(user.id))
    from backend.core.tools.execute_skill_op import ExecuteSkillOp

    op = ExecuteSkillOp()
    op.input_dict = {"skill_uuid": skill.id, "version": "1.0.0"}
    await op.async_execute()
    payload = json.loads(op._output)
    assert payload["code"] == "COMMAND_BLOCKED"
    assert "local script command" in payload["detail"].lower()


@pytest.mark.asyncio
async def test_skill_detail_resource_reference_uses_public_source(async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    _install_flowllm_stubs(tmp_path, monkeypatch)
    from backend.db import session as db_session

    monkeypatch.setattr(db_session, "get_async_session", lambda: _override_session(async_session))
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)

    user = User(email="ref@example.com", username="ref", hashed_password="x")
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)

    public_skill = Skill(
        user_id="00000000-0000-0000-0000-000000000001",
        name="public-skill",
        description="public desc",
        tags=["public"],
        visibility="public",
        skill_dir=str(get_user_skill_dir("00000000-0000-0000-0000-000000000001", "public-skill")),
        current_version="1.2.3",
        is_active=True,
    )
    async_session.add(public_skill)
    await async_session.commit()
    await async_session.refresh(public_skill)

    reference_skill = Skill(
        user_id=user.id,
        name="public-skill-ref",
        description="ref desc",
        tags=["public"],
        visibility="private",
        source_skill_id=public_skill.id,
        pinned_version="1.2.3",
        skill_dir="",
        current_version=None,
        is_active=True,
    )
    async_session.add(reference_skill)
    await async_session.commit()
    await async_session.refresh(reference_skill)

    version = SkillVersion(
        skill_id=public_skill.id,
        version="1.2.3",
        description="public desc",
        dependencies=["requests"],
        dependency_spec={"schema_version": 1},
        dependency_spec_version="1",
        metadata_json={"name": "public-skill", "description": "public desc", "version": "1.2.3"},
    )
    async_session.add(version)
    await async_session.commit()

    version_dir = get_skill_versions_dir(public_skill.user_id, public_skill.name) / "1.2.3"
    version_dir.mkdir(parents=True, exist_ok=True)
    (version_dir / "SKILL.md").write_text(
        "---\nname: public-skill\ndescription: public desc\nparameters:\n  type: object\n---\nbody",
        encoding="utf-8",
    )
    (version_dir / "reference.md").write_text("from public source", encoding="utf-8")

    set_current_user_id(str(user.id))
    from backend.core.tools.skill_resource_ops import SkillDetailResourceOp

    detail_op = SkillDetailResourceOp()
    detail_op.input_dict = {"skill_uuid": reference_skill.id}
    await detail_op.async_execute()
    payload = json.loads(detail_op._output)
    detail = json.loads(payload["contents"][0]["text"])
    assert detail["skill_id"] == reference_skill.id
    assert detail["version"] == "1.2.3"
    assert detail["author"] == public_skill.user_id
    assert detail["dependencies"] == ["requests"]


@pytest.mark.asyncio
async def test_skill_detail_resource_reference_source_unavailable(async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    _install_flowllm_stubs(tmp_path, monkeypatch)
    from backend.db import session as db_session

    monkeypatch.setattr(db_session, "get_async_session", lambda: _override_session(async_session))
    user = User(email="missing@example.com", username="missing", hashed_password="x")
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)

    reference_skill = Skill(
        user_id=user.id,
        name="broken-ref",
        description="broken",
        tags=[],
        visibility="private",
        source_skill_id="missing-source-id",
        pinned_version="1.2.3",
        skill_dir="",
        current_version=None,
        is_active=True,
    )
    async_session.add(reference_skill)
    await async_session.commit()
    await async_session.refresh(reference_skill)

    set_current_user_id(str(user.id))
    from backend.core.tools.skill_resource_ops import SkillDetailResourceOp

    detail_op = SkillDetailResourceOp()
    detail_op.input_dict = {"skill_uuid": reference_skill.id}
    await detail_op.async_execute()
    payload = json.loads(detail_op._output)
    assert payload["code"] == "SOURCE_SKILL_UNAVAILABLE"


@pytest.mark.asyncio
async def test_execute_skill_reference_source_unavailable(async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    _install_flowllm_stubs(tmp_path, monkeypatch)
    from backend.db import session as db_session

    monkeypatch.setattr(db_session, "get_async_session", lambda: _override_session(async_session))
    user = User(email="exec-ref@example.com", username="exec-ref", hashed_password="x")
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)

    reference_skill = Skill(
        user_id=user.id,
        name="broken-exec-ref",
        description="broken",
        tags=[],
        visibility="private",
        source_skill_id="missing-source-id",
        pinned_version="1.2.3",
        skill_dir="",
        current_version=None,
        is_active=True,
    )
    async_session.add(reference_skill)
    await async_session.commit()
    await async_session.refresh(reference_skill)

    set_current_user_id(str(user.id))
    from backend.core.tools.execute_skill_op import ExecuteSkillOp

    op = ExecuteSkillOp()
    op.input_dict = {"skill_uuid": reference_skill.id}
    await op.async_execute()
    payload = json.loads(op._output)
    assert payload["code"] == "SOURCE_SKILL_UNAVAILABLE"


@pytest.mark.asyncio
async def test_mcp_authorize_accepts_jwt(async_session, monkeypatch):
    user = User(email="jwt@example.com", username="jwt", hashed_password="x")
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    token = create_access_token(str(user.id))
    from backend.api import mcp as mcp_module
    from backend.db import session as db_session

    monkeypatch.setattr(db_session, "get_async_session", lambda: _override_session(async_session))
    monkeypatch.setattr(mcp_module, "get_async_session", lambda: _override_session(async_session))
    scope = {"type": "http", "headers": [(b"authorization", f"Bearer {token}".encode())]}

    async def receive():
        return {"type": "http.request"}

    sent = {}

    async def send(message):
        sent["message"] = message

    authorized = await mcp_module._authorize_mcp_request(scope, receive, send)
    assert authorized is True


@pytest.mark.asyncio
async def test_mcp_authorize_rejects_revoked_jwt(async_session, monkeypatch):
    user = User(email="revoked@example.com", username="revoked", hashed_password="x")
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    token = create_access_token(str(user.id), token_version=user.jwt_token_version)
    user.jwt_token_version += 1
    await async_session.commit()
    from backend.api import mcp as mcp_module
    from backend.db import session as db_session

    monkeypatch.setattr(db_session, "get_async_session", lambda: _override_session(async_session))
    monkeypatch.setattr(mcp_module, "get_async_session", lambda: _override_session(async_session))
    scope = {"type": "http", "headers": [(b"authorization", f"Bearer {token}".encode())]}

    async def receive():
        return {"type": "http.request"}

    sent_messages = []

    async def send(message):
        sent_messages.append(message)

    authorized = await mcp_module._authorize_mcp_request(scope, receive, send)
    assert authorized is False
    body = next(message for message in sent_messages if message["type"] == "http.response.body")
    assert b"TOKEN_REVOKED" in body["body"]
