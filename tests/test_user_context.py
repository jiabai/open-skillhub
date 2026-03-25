import importlib.util
from pathlib import Path


def load_user_context_module():
    module_path = Path(__file__).resolve().parents[1] / "backend" / "core" / "utils" / "user_context.py"
    spec = importlib.util.spec_from_file_location("user_context_module", module_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_default_user_id_is_none():
    module = load_user_context_module()
    assert module.get_current_user_id() is None


def test_set_and_get_user_id():
    module = load_user_context_module()
    module.set_current_user_id("user-1")
    assert module.get_current_user_id() == "user-1"


def test_reset_user_id_to_none():
    module = load_user_context_module()
    module.set_current_user_id("user-2")
    module.set_current_user_id(None)
    assert module.get_current_user_id() is None
