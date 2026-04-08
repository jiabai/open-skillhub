import re
import shlex
from dataclasses import dataclass

from backend.config.settings import settings


BLOCKED_PATTERNS: list[str] = [
    r"rm\s+-rf",
    r"sudo",
    r">\s*/etc/",
    r"curl.*\|.*bash",
    r"wget.*\|.*sh",
    r"\.\./",
    r"\.\.\\",
]

NETWORK_EGRESS_PATTERNS: list[str] = [
    r"https?://",
    r"\burllib\.request\b",
    r"\brequests\.",
    r"\bsocket\b",
    r"\bhttpx\.",
    r"\bwebsockets?\b",
    r"\bping\b",
    r"\bnslookup\b",
    r"\btraceroute\b",
    r"\bcurl\b",
    r"\bwget\b",
]

_LOCAL_SCRIPT_COMMANDS = {"python", "python3", "node", "bash", "sh"}
_PACKAGE_MANAGER_COMMANDS = {"pip", "pip3", "npm", "pnpm", "yarn", "uv"}


@dataclass(frozen=True)
class CommandPolicy:
    category: str
    allows_network: bool = False
    description: str = ""


def _match_blocked_patterns(command: str) -> tuple[bool, str]:
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return False, f"Command contains blocked pattern: {pattern}"
    return True, "OK"


def _classify_local_script_command(base_cmd: str, args: list[str]) -> CommandPolicy | None:
    if base_cmd not in _LOCAL_SCRIPT_COMMANDS:
        return None
    if base_cmd in {"bash", "sh"} and not args:
        return None
    return CommandPolicy(category="local_script", allows_network=False, description="Local script execution")


def _classify_package_manager_command(base_cmd: str, args: list[str]) -> CommandPolicy | None:
    if base_cmd not in _PACKAGE_MANAGER_COMMANDS:
        return None

    if base_cmd in {"pip", "pip3"}:
        if args[:1] == ["install"] and len(args) >= 2:
            return CommandPolicy(category="package_manager", allows_network=True, description="Python package install")
        return None

    if base_cmd == "uv":
        if args[:1] == ["sync"]:
            return CommandPolicy(category="package_manager", allows_network=True, description="uv environment sync")
        if args[:2] == ["pip", "install"] and len(args) >= 3:
            return CommandPolicy(category="package_manager", allows_network=True, description="uv pip install")
        return None

    if base_cmd == "npm" and args[:1] in (["install"], ["ci"]):
        return CommandPolicy(category="package_manager", allows_network=True, description="npm dependency install")

    if base_cmd == "pnpm" and args[:1] == ["install"]:
        return CommandPolicy(category="package_manager", allows_network=True, description="pnpm dependency install")

    if base_cmd == "yarn" and args[:1] == ["install"]:
        return CommandPolicy(category="package_manager", allows_network=True, description="yarn dependency install")

    return None


def get_command_policy(command: str) -> tuple[CommandPolicy | None, str]:
    try:
        cmd_parts = shlex.split(command, posix=True)
    except ValueError as exc:
        return None, str(exc)
    if not cmd_parts:
        return None, "Empty command"

    base_cmd = cmd_parts[0].split("/")[-1].split("\\")[-1].lower()
    args = cmd_parts[1:]

    is_allowed, error = _match_blocked_patterns(command)
    if not is_allowed:
        return None, error

    policy = _classify_local_script_command(base_cmd, args)
    if policy is None:
        policy = _classify_package_manager_command(base_cmd, args)
    if policy is None:
        return None, f"Command '{base_cmd}' is not allowed"

    if settings.ENABLE_NETWORK_EGRESS_CONTROL and not policy.allows_network:
        for pattern in NETWORK_EGRESS_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                return None, "Command contains blocked network egress pattern"

    return policy, "OK"


def validate_command(command: str) -> tuple[bool, str]:
    policy, message = get_command_policy(command)
    return policy is not None, message
