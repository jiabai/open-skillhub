import shlex


def split_command_args(command: str) -> list[str]:
    parts = shlex.split(command, posix=True)
    if not parts:
        raise ValueError("Empty command")
    return parts


def quote_shell_arg(value: str) -> str:
    return shlex.quote(value)
