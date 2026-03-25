"""Simple integration test for the LoadSkillOp operator."""

import sys
import asyncio

from backend import SkillHubMcpApp
from backend.core.tools import LoadSkillMetadataOp, LoadSkillOp


async def main(skill_dir: str, skill_name: str):
    """Execute the load_skill operation given a skill directory and a skill name."""
    async with SkillHubMcpApp(
        f"metadata.skill_dir={skill_dir}",
    ):
        op = LoadSkillMetadataOp()
        await op.async_call()

        op = LoadSkillOp()
        await op.async_call(skill_name=skill_name)
        print(op.output)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: test_load_skill_op.py [skills directory] [skill_name]")
        sys.exit(1)
    asyncio.run(main(sys.argv[1], sys.argv[2]))
