import { createFilesystemAgentAdapter } from "@/adapters/agents/base"

export const claudeCodeAgentAdapter = createFilesystemAgentAdapter({
  id: "claude-code",
  displayName: "Claude Code"
})

export function createClaudeCodeAgentAdapter() {
  return claudeCodeAgentAdapter
}
