import { createFilesystemAgentAdapter } from "@/adapters/agents/base"

export const codexAgentAdapter = createFilesystemAgentAdapter({
  id: "codex",
  displayName: "Codex"
})

export function createCodexAgentAdapter() {
  return codexAgentAdapter
}
