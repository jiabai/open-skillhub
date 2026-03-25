"""Configuration helpers for the Open SkillHub package.

The configuration layer is built on top of FlowLLM's ``PydanticConfigParser``
and exposes a single public ``ConfigParser`` class that knows how to locate
and load skillhub specific settings.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.config.config_parser import ConfigParser


def __getattr__(name: str):
    if name == "ConfigParser":
        from backend.config.config_parser import ConfigParser

        return ConfigParser
    raise AttributeError(name)


__all__ = ["ConfigParser"]
