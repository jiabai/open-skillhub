"""Agent operations for using skills.

This module provides operations for using Anthropic's Agent Skills,
including loading skill metadata, reading reference files, and running shell commands.
The classes imported here are registered
as operations in the underlying FlowLLM runtime and are intended to be
referenced via that framework rather than instantiated directly.
"""

from .execute_skill_op import ExecuteSkillOp
from .load_skill_metadata_op import LoadSkillMetadataOp
from .load_skill_op import LoadSkillOp
from .read_reference_file_op import ReadReferenceFileOp
from .run_shell_command_op import RunShellCommandOp
from .skill_resource_ops import SkillDetailResourceOp, SkillListResourceOp

__all__ = [
    "ExecuteSkillOp",
    "LoadSkillMetadataOp",
    "LoadSkillOp",
    "ReadReferenceFileOp",
    "RunShellCommandOp",
    "SkillDetailResourceOp",
    "SkillListResourceOp",
]
