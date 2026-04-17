import { createFilesystemAgentAdapter } from "@/adapters/agents/base"

export const geminiCliAgentAdapter = createFilesystemAgentAdapter({
  id: "gemini-cli",
  displayName: "Gemini CLI"
})

export function createGeminiCliAgentAdapter() {
  return geminiCliAgentAdapter
}
