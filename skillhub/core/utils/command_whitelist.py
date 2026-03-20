import re
from typing import Set

from skillhub.config.settings import settings

ALLOWED_COMMANDS: Set[str] = {
    "python",
    "python3",
    "node",
    "npm",
    "bash",
    "sh",
}

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


def validate_command(command: str) -> tuple[bool, str]:
    cmd_parts = command.split()
    if not cmd_parts:
        return False, "Empty command"

    base_cmd = cmd_parts[0].split("/")[-1].split("\\")[-1]
    if base_cmd not in ALLOWED_COMMANDS:
        return False, f"Command '{base_cmd}' is not allowed"

    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return False, f"Command contains blocked pattern: {pattern}"

    if settings.ENABLE_NETWORK_EGRESS_CONTROL:
        for pattern in NETWORK_EGRESS_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                return False, "Command contains blocked network egress pattern"

    return True, "OK"
