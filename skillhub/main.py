"""CLI 入口点，负责启动 FlowLLM 独立模式。

此模块只负责命令行入口，SkillHubMcpApp 类已移至 core/app.py。
"""

import sys

from skillhub.core.app import SkillHubMcpApp


def main() -> None:
    """Run the SkillHub MCP service as a command-line application.

    The function builds :class:`SkillHubMcpApp` from the command-line arguments
    (excluding the script name) and starts the FlowLLM service loop.
    """
    with SkillHubMcpApp(*sys.argv[1:]) as app:
        app.run_service()


if __name__ == "__main__":
    main()
