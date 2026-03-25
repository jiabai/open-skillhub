"""Simple integration test for the RunShellCommandOp operator."""

import sys
import asyncio

from backend import SkillHubMcpApp
from backend.core.tools import LoadSkillMetadataOp, RunShellCommandOp
from backend.core.utils.command_whitelist import validate_command


def test_command_whitelist_blocks_windows_traversal():
    allowed, message = validate_command(r"python ..\..\script.py")
    assert allowed is False
    assert "blocked pattern" in message.lower()


def test_command_whitelist_blocks_network_egress_when_enabled(monkeypatch):
    from backend.config import settings as settings_module

    monkeypatch.setattr(settings_module.settings, "ENABLE_NETWORK_EGRESS_CONTROL", True, raising=False)
    allowed, message = validate_command(
        'python -c "import urllib.request; urllib.request.urlopen(\'https://example.com\')"'
    )
    assert allowed is False
    assert "network egress" in message.lower()


def test_command_whitelist_allows_network_related_text_when_disabled(monkeypatch):
    from backend.config import settings as settings_module

    monkeypatch.setattr(settings_module.settings, "ENABLE_NETWORK_EGRESS_CONTROL", False, raising=False)
    allowed, _ = validate_command(
        'python -c "import urllib.request; urllib.request.urlopen(\'https://example.com\')"'
    )
    assert allowed is True


async def main(skill_dir: str, skill_name: str, command: str):
    """Execute the run_shell_command operation given a skill directory, a skill name, and a command."""
    async with SkillHubMcpApp(
        f"metadata.skill_dir={skill_dir}",
    ):
        op = LoadSkillMetadataOp()
        await op.async_call()

        op = RunShellCommandOp()
        await op.async_call(skill_name=skill_name, command=command)
        print(op.output)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: test_run_shell_command_op.py [skills directory] [skill_name] [command]")
        sys.exit(1)
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3]))
