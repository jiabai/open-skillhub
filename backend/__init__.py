# flake8: noqa: E402
# pylint: disable=wrong-import-position

"""Public package interface for the Open SkillHub library.

This module exposes the high-level objects that users are expected to import
from :mod:`backend`. It also sets the :envvar:`FLOW_APP_NAME` environment
variable so that the underlying FlowLLM framework can correctly associate
configuration and logging with this application.
"""

import os
from typing import TYPE_CHECKING

# Hint FlowLLM about the logical application name. This is used by the
# framework to locate configuration files and to tag logs/telemetry.
os.environ["FLOW_APP_NAME"] = "SkillHubMCP"

if TYPE_CHECKING:
    from backend.config.config_parser import ConfigParser
    from backend.main import SkillHubMcpApp


def __getattr__(name: str):
    if name == "SkillHubMcpApp":
        from backend.main import SkillHubMcpApp

        return SkillHubMcpApp
    if name == "ConfigParser":
        from backend.config.config_parser import ConfigParser

        return ConfigParser
    raise AttributeError(name)

__all__ = ["SkillHubMcpApp", "ConfigParser"]

# Library version. Keep in sync with the project metadata.
__version__ = "0.1.2"
