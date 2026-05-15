import {
  resolveCliDistributionTargets,
  type CliDistributionScope,
  type ResolveCliDistributionTargetsRequest
} from "@/cli/services/cli-targets"
import type { AgentId } from "@/types"

export interface RunDetectCommandRequest {
  scope: CliDistributionScope
  agentFilter?: AgentId[]
  targetOptions?: Omit<ResolveCliDistributionTargetsRequest, "scope" | "agentFilter">
}

export async function runDetectCommand(request: RunDetectCommandRequest) {
  return resolveCliDistributionTargets({
    ...request.targetOptions,
    scope: request.scope,
    agentFilter: request.agentFilter
  })
}
