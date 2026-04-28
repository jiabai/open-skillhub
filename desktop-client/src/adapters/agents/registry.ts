import type { AgentAdapterV1 } from "@/adapters/agents/base"
import { createFilesystemAgentAdapter } from "@/adapters/agents/base"
import { supportedAgentDefinitions } from "@/adapters/agents/definitions"
import type { AgentId } from "@/types"

const agentAdapters = supportedAgentDefinitions.reduce<Record<AgentId, AgentAdapterV1>>(
  (adapters, definition) => {
    adapters[definition.id] = createFilesystemAgentAdapter({
      id: definition.id,
      displayName: definition.displayName
    })

    return adapters
  },
  {} as Record<AgentId, AgentAdapterV1>
)

export function getAgentAdapter(agentId: AgentId): AgentAdapterV1 {
  return agentAdapters[agentId]
}

export function listAgentAdapters(): AgentAdapterV1[] {
  return supportedAgentDefinitions.map((definition) => agentAdapters[definition.id])
}

export function hasAgentAdapter(agentId: string): agentId is AgentId {
  return agentId in agentAdapters
}
