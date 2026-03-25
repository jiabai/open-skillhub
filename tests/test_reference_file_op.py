"""Simple integration test for the ReadReferenceFileOp operator."""

import sys
import asyncio

from backend import SkillHubMcpApp
from backend.core.tools import LoadSkillMetadataOp, ReadReferenceFileOp


async def main(skill_dir: str, skill_name: str, file_name: str):
    """Execute the read_reference_file operation given a skill directory, a skill name, and a file name."""
    async with SkillHubMcpApp(
        f"metadata.skill_dir={skill_dir}",
    ):
        op = LoadSkillMetadataOp()
        await op.async_call()

        op = ReadReferenceFileOp()
        await op.async_call(skill_name=skill_name, file_name=file_name)
        print(op.output)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: test_reference_file_op.py [skills directory] [skill_name] [file_name]")
        sys.exit(1)
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3]))
