"""Simple integration test for the LoadSkillMetadataOp operator."""

import sys
import asyncio

from backend import SkillHubMcpApp
from backend.core.tools import LoadSkillMetadataOp


async def main(skill_dir: str):
    """Execute the load_skill_metadata operation given a skill directory."""
    async with SkillHubMcpApp(
        f"metadata.skill_dir={skill_dir}",
    ):
        op = LoadSkillMetadataOp()
        await op.async_call()
        print(op.output)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: test_load_skill_metadata_op.py [skills directory]")
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
