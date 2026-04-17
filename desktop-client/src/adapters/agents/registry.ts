import type { AgentAdapterV1, AgentId } from "@/adapters/agents/base"
import { claudeCodeAgentAdapter } from "@/adapters/agents/claude-code"
import { codexAgentAdapter } from "@/adapters/agents/codex"
import { geminiCliAgentAdapter } from "@/adapters/agents/gemini-cli"

const agentAdapters: Record<AgentId, AgentAdapterV1> = {
  codex: codexAgentAdapter,
  "claude-code": claudeCodeAgentAdapter,
  "gemini-cli": geminiCliAgentAdapter
}

export function getAgentAdapter(agentId: AgentId): AgentAdapterV1 {
  return agentAdapters[agentId]
}

export function listAgentAdapters(): AgentAdapterV1[] {
  return [agentAdapters.codex, agentAdapters["claude-code"], agentAdapters["gemini-cli"]]
}

export function hasAgentAdapter(agentId: string): agentId is AgentId {
  return agentId in agentAdapters
}
