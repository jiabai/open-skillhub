import asyncio
import json
import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from typing import Any


def load_module(module_name: str, module_path: Path):
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def install_flowllm_stubs(skill_dir: Path, monkeypatch):
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

        def get_prompt(self, _prompt_name: str):
            return "{skill_dir}"

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


def install_mcp_package_stubs(monkeypatch, user_context_module, command_whitelist_module=None, skill_status=None):
    backend_module = ModuleType("backend")
    backend_module.__path__ = []
    mcp_core = ModuleType("backend.core")
    mcp_core.__path__ = []
    mcp_utils = ModuleType("backend.core.utils")
    mcp_utils.__path__ = []
    mcp_utils_skill_storage = ModuleType("backend.core.utils.skill_storage")
    mcp_metrics = ModuleType("backend.core.metrics")
    mcp_metrics.__path__ = []
    mcp_metrics_tool_call = ModuleType("backend.core.metrics.tool_call_metrics")
    mcp_db = ModuleType("backend.db")
    mcp_db.__path__ = []
    mcp_db_session = ModuleType("backend.db.session")
    mcp_repositories = ModuleType("backend.repositories")
    mcp_repositories.__path__ = []
    mcp_repositories_skill = ModuleType("backend.repositories.skill")

    # Add skill_storage functions
    import json
    from datetime import datetime, timezone

    def tool_error_payload(detail: object, code: str) -> str:
        return json.dumps({
            "detail": detail,
            "code": code,
            "timestamp": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        })

    def validate_skill_name(name: str):
        if not name or not name.strip():
            return False, "Skill name cannot be empty"
        if len(name) > 100:
            return False, "Skill name too long"
        return True, ""

    def validate_file_path(path: str):
        return True, ""

    mcp_utils_skill_storage.tool_error_payload = tool_error_payload
    mcp_utils_skill_storage.validate_skill_name = validate_skill_name
    mcp_utils_skill_storage.validate_file_path = validate_file_path

    monkeypatch.setitem(sys.modules, "backend", backend_module)
    monkeypatch.setitem(sys.modules, "backend.core", mcp_core)
    monkeypatch.setitem(sys.modules, "backend.core.utils", mcp_utils)
    monkeypatch.setitem(sys.modules, "backend.core.utils.user_context", user_context_module)
    monkeypatch.setitem(sys.modules, "backend.core.utils.skill_storage", mcp_utils_skill_storage)
    monkeypatch.setitem(sys.modules, "backend.core.metrics", mcp_metrics)
    monkeypatch.setitem(sys.modules, "backend.core.metrics.tool_call_metrics", mcp_metrics_tool_call)
    if command_whitelist_module:
        monkeypatch.setitem(sys.modules, "backend.core.utils.command_whitelist", command_whitelist_module)
    monkeypatch.setitem(sys.modules, "backend.db", mcp_db)
    monkeypatch.setitem(sys.modules, "backend.db.session", mcp_db_session)
    monkeypatch.setitem(sys.modules, "backend.repositories", mcp_repositories)
    monkeypatch.setitem(sys.modules, "backend.repositories.skill", mcp_repositories_skill)

    status_map = skill_status or {}

    class SkillRecord:
        def __init__(self, is_active: bool):
            self.is_active = is_active

    class SkillRepository:
        def __init__(self, _session):
            self._session = _session

        async def get_by_name(self, user_id: str, name: str):
            active = status_map.get((user_id, name))
            if active is None:
                return None
            return SkillRecord(is_active=active)

    async def get_async_session():
        class DummySession:
            pass

        yield DummySession()

    mcp_db_session.get_async_session = get_async_session
    mcp_repositories_skill.SkillRepository = SkillRepository
    async def record_tool_call(*_args, **_kwargs):
        return None

    mcp_metrics_tool_call.record_tool_call = record_tool_call


def write_skill(base: Path, skill_name: str, description: str, body: str):
    skill_dir = base / skill_name
    skill_dir.mkdir(parents=True, exist_ok=True)
    content = f"---\nname: {skill_name}\ndescription: {description}\n---\n{body}\n"
    (skill_dir / "SKILL.md").write_text(content, encoding="utf-8")


def load_user_context():
    module_path = Path(__file__).resolve().parents[1] / "backend" / "core" / "utils" / "user_context.py"
    return load_module("backend.core.utils.user_context", module_path)


def load_command_whitelist():
    module_path = Path(__file__).resolve().parents[1] / "backend" / "core" / "utils" / "command_whitelist.py"
    return load_module("backend.core.utils.command_whitelist", module_path)


def load_process_exec():
    module_path = Path(__file__).resolve().parents[1] / "backend" / "core" / "utils" / "process_exec.py"
    return load_module("backend.core.utils.process_exec", module_path)


def test_load_skill_metadata_scopes_by_user_id(tmp_path, monkeypatch):
    user_context = load_user_context()
    command_whitelist = load_command_whitelist()
    install_mcp_package_stubs(monkeypatch, user_context, command_whitelist)
    install_flowllm_stubs(tmp_path, monkeypatch)

    write_skill(tmp_path, "global_skill", "global", "global body")
    write_skill(tmp_path / "user-1", "user_skill", "user", "user body")

    module_path = (
        Path(__file__).resolve().parents[1] / "backend" / "core" / "tools" / "load_skill_metadata_op.py"
    )
    module = load_module("backend.core.tools.load_skill_metadata_op", module_path)

    user_context.set_current_user_id("user-1")
    op = module.LoadSkillMetadataOp()
    asyncio.run(op.async_execute())
    assert "user_skill" in op._output
    assert "global_skill" not in op._output

    user_context.set_current_user_id(None)
    op = module.LoadSkillMetadataOp()
    asyncio.run(op.async_execute())
    assert "global_skill" in op._output


def test_load_skill_scopes_by_user_id(tmp_path, monkeypatch):
    user_context = load_user_context()
    command_whitelist = load_command_whitelist()
    install_mcp_package_stubs(monkeypatch, user_context, command_whitelist)
    install_flowllm_stubs(tmp_path, monkeypatch)

    write_skill(tmp_path, "shared_skill", "global", "global body")
    write_skill(tmp_path / "user-2", "shared_skill", "user", "user body")

    module_path = Path(__file__).resolve().parents[1] / "backend" / "core" / "tools" / "load_skill_op.py"
    module = load_module("backend.core.tools.load_skill_op", module_path)

    user_context.set_current_user_id("user-2")
    op = module.LoadSkillOp()
    op.input_dict = {"skill_name": "shared_skill"}
    asyncio.run(op.async_execute())
    assert "user body" in op._output

    user_context.set_current_user_id(None)
    op = module.LoadSkillOp()
    op.input_dict = {"skill_name": "shared_skill"}
    asyncio.run(op.async_execute())
    assert "global body" in op._output


def test_load_skill_blocks_deactivated(tmp_path, monkeypatch):
    user_context = load_user_context()
    command_whitelist = load_command_whitelist()
    install_mcp_package_stubs(
        monkeypatch,
        user_context,
        command_whitelist,
        {("user-9", "blocked_skill"): False},
    )
    install_flowllm_stubs(tmp_path, monkeypatch)

    write_skill(tmp_path / "user-9", "blocked_skill", "user", "blocked body")

    module_path = Path(__file__).resolve().parents[1] / "backend" / "core" / "tools" / "load_skill_op.py"
    module = load_module("backend.core.tools.load_skill_op", module_path)

    user_context.set_current_user_id("user-9")
    op = module.LoadSkillOp()
    op.input_dict = {"skill_name": "blocked_skill"}
    asyncio.run(op.async_execute())
    payload = json.loads(op._output)
    assert payload["code"] == "SKILL_DEACTIVATED"
    assert payload["timestamp"].endswith("Z")


def test_read_reference_file_scopes_by_user_id(tmp_path, monkeypatch):
    user_context = load_user_context()
    command_whitelist = load_command_whitelist()
    install_mcp_package_stubs(monkeypatch, user_context, command_whitelist)
    install_flowllm_stubs(tmp_path, monkeypatch)

    write_skill(tmp_path, "skill_x", "global", "global body")
    write_skill(tmp_path / "user-3", "skill_x", "user", "user body")

    (tmp_path / "skill_x" / "reference.md").write_text("global ref", encoding="utf-8")
    (tmp_path / "user-3" / "skill_x" / "reference.md").write_text("user ref", encoding="utf-8")

    module_path = (
        Path(__file__).resolve().parents[1] / "backend" / "core" / "tools" / "read_reference_file_op.py"
    )
    module = load_module("backend.core.tools.read_reference_file_op", module_path)

    user_context.set_current_user_id("user-3")
    op = module.ReadReferenceFileOp()
    op.input_dict = {"skill_name": "skill_x", "file_name": "reference.md"}
    asyncio.run(op.async_execute())
    assert op._output == "user ref"

    user_context.set_current_user_id(None)
    op = module.ReadReferenceFileOp()
    op.input_dict = {"skill_name": "skill_x", "file_name": "reference.md"}
    asyncio.run(op.async_execute())
    assert op._output == "global ref"


def test_run_shell_command_uses_user_scoped_workdir(tmp_path, monkeypatch):
    user_context = load_user_context()
    command_whitelist = load_command_whitelist()
    process_exec = load_process_exec()
    install_mcp_package_stubs(monkeypatch, user_context, command_whitelist)
    monkeypatch.setitem(sys.modules, "backend.core.utils.process_exec", process_exec)
    install_flowllm_stubs(tmp_path, monkeypatch)

    write_skill(tmp_path, "skill_cmd", "global", "global body")
    write_skill(tmp_path / "user-4", "skill_cmd", "user", "user body")

    module_path = Path(__file__).resolve().parents[1] / "backend" / "core" / "tools" / "run_shell_command_op.py"
    module = load_module("backend.core.tools.run_shell_command_op", module_path)

    captured = {}

    async def fake_create_subprocess_exec(*args, **kwargs):
        captured["args"] = list(args)
        captured["cwd"] = kwargs.get("cwd")

        class Proc:
            returncode = 0

            async def communicate(self):
                return b"ok", b""

        return Proc()

    module.asyncio.create_subprocess_exec = fake_create_subprocess_exec

    user_context.set_current_user_id("user-4")
    op = module.RunShellCommandOp(auto_install_deps=False)
    op.input_dict = {"skill_name": "skill_cmd", "command": 'python -c "print(1)"'}
    asyncio.run(op.async_execute())
    expected_dir = str(tmp_path / "user-4" / "skill_cmd")
    assert captured["cwd"] == expected_dir
    assert captured["args"] == ["python", "-c", "print(1)"]
