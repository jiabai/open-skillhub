"""Test module for the skillhub-mcp MCP service over HTTP.

This module exercises the skillhub-mcp MCP service by:

1. Starting the service with the given configuration using
   :class:`AgentskillsMcpServiceRunner`.
2. Connecting to the service via :class:`FastMcpClient`.
3. Listing available tools exposed by the MCP server.
4. Invoking a selection of tools and asserting that each call succeeds.

It is intended as an integration/diagnostic script rather than a unit test.
"""

import sys
import json
import asyncio

from loguru import logger
from fastmcp.client.client import CallToolResult
from flowllm.core.utils.fastmcp_client import FastMcpClient
from backend.core.utils.service_runner import SkillHubMcpServiceRunner


async def test_mcp_service(mcp_config) -> None:
    """Connect to the MCP service, list tools, and run sample tool calls."""

    # Connect to the MCP service using FastMcpClient
    async with FastMcpClient(
        name="skillhub-mcp-test",
        config=mcp_config,
        max_retries=1,
    ) as client:
        # List available tools
        print("=" * 50)
        print("Getting available MCP tools...")
        tool_calls = await client.list_tool_calls()
        print(f"Found {len(tool_calls)} tools:")
        for tool_call in tool_calls:
            tool_info = tool_call.simple_input_dump()
            print(json.dumps(tool_info, ensure_ascii=False))

        for tool_name, test_arguments in [
            ("load_skill_metadata", {}),
            ("load_skill", {"skill_name": "pdf"}),
            ("read_reference_file", {"skill_name": "pdf", "file_name": "reference.md"}),
            ("run_shell_command", {"skill_name": "pdf", "command": "ls -l"}),
        ]:
            result: CallToolResult = await client.call_tool(tool_name, test_arguments)
            result_content = result.content[0].text
            success = not result.is_error
            print(f"Tool call result: {tool_name}, success: {success}, content: {result_content}")
            assert success


def main(skill_dir: str) -> None:
    """Run the MCP service in-process and execute the async test routine."""
    # Service configuration
    service_args = [
        "skillhub-mcp",
        "config=default",
        "mcp.transport=sse",
        f"metadata.skill_dir={skill_dir}",
    ]

    # MCP client configuration
    host = "0.0.0.0"
    port = 8150
    mcp_config = {
        "type": "sse",
        "url": f"http://{host}:{port}/sse",
    }

    with SkillHubMcpServiceRunner(
        service_args,
        host=host,
        port=port,
    ) as service:
        logger.info(f"Service is running on port {service.port}")

        asyncio.run(test_mcp_service(mcp_config))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Please provide the skill directory as a command line argument.")
        sys.exit(1)
    main(sys.argv[1])
