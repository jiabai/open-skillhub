import type { AgentAdapterV1, AgentInstallContextV1 } from "@/adapters/agents/base"
import type {
  PreparedSkillPackage,
  SkillDistributionTarget,
  SkillDistributionTargetResult
} from "@/types"

export interface DistributionWriteServiceDependencies {
  resolveAgentAdapter(agentId: string): AgentAdapterV1 | null | undefined
}

export interface DistributionWriteRequest {
  preparedPackage: PreparedSkillPackage | null
  targets: SkillDistributionTarget[]
}

export interface DistributionWriteResult {
  targets: SkillDistributionTargetResult[]
  succeededAgentIds: string[]
  failedAgentIds: string[]
  allSucceeded: boolean
}

export interface DistributionWriteService {
  write(request: DistributionWriteRequest): Promise<DistributionWriteResult>
}

function createTargetFailure(
  agentId: string,
  targetPath: string,
  error: unknown
): SkillDistributionTargetResult {
  return {
    agentId,
    targetPath,
    status: "failed",
    success: false,
    errorMessage: error instanceof Error ? error.message : String(error)
  }
}

function createTargetSuccess(
  agentId: string,
  targetPath: string,
  status: SkillDistributionTargetResult["status"] = "success"
): SkillDistributionTargetResult {
  return {
    agentId,
    targetPath,
    status,
    success: true,
    errorMessage: null
  }
}

function createSkipResults(target: SkillDistributionTarget): SkillDistributionTargetResult[] {
  return target.coveredAgentIds.map((agentId) =>
    createTargetSuccess(agentId, target.targetPath, "skipped-installed-content")
  )
}

function createSuccessfulWriteResults(target: SkillDistributionTarget): SkillDistributionTargetResult[] {
  return target.coveredAgentIds.map((agentId, index) =>
    createTargetSuccess(
      agentId,
      target.targetPath,
      index === 0 ? "success" : "covered-by-shared-path"
    )
  )
}

function createFailureResults(
  target: SkillDistributionTarget,
  error: unknown,
  agentIdOverride?: string
): SkillDistributionTargetResult[] {
  const agentIds = agentIdOverride ? [agentIdOverride] : target.coveredAgentIds

  return agentIds.map((agentId) => createTargetFailure(agentId, target.targetPath, error))
}

function summarizeResults(targetResults: SkillDistributionTargetResult[]): Omit<DistributionWriteResult, "targets"> {
  const succeededAgentIds = targetResults
    .filter((result) => result.success)
    .map((result) => result.agentId)
  const failedAgentIds = targetResults
    .filter((result) => !result.success)
    .map((result) => result.agentId)

  return {
    succeededAgentIds,
    failedAgentIds,
    allSucceeded: failedAgentIds.length === 0
  }
}

export function createDistributionWriteService(
  dependencies: DistributionWriteServiceDependencies
): DistributionWriteService {
  return {
    async write(request: DistributionWriteRequest): Promise<DistributionWriteResult> {
      const targetResults: SkillDistributionTargetResult[] = []

      for (const target of request.targets) {
        if (target.writeMode === "skip-installed-content") {
          targetResults.push(...createSkipResults(target))
          continue
        }

        const adapterAgentId = target.adapterAgentId ?? target.primaryAgentId
        const adapter = dependencies.resolveAgentAdapter(adapterAgentId)
        const installContext: AgentInstallContextV1 = {
          skillsPath: target.targetPath,
          ...(target.skillLayout ? { skillLayout: target.skillLayout } : {})
        }

        if (!adapter) {
          targetResults.push(
            ...createFailureResults(
              target,
              new Error(`No adapter registered for agent: ${adapterAgentId}`),
              target.adapterAgentId
            )
          )
          continue
        }

        try {
          if (!request.preparedPackage) {
            throw new Error("Prepared package unavailable for write target")
          }

          const installedSkill = await adapter.installSkill(request.preparedPackage, installContext)
          const verified = await adapter.verifyInstalledSkill(request.preparedPackage, installedSkill)

          if (!verified) {
            throw new Error(`Installed skill verification failed for agent: ${adapterAgentId}`)
          }

          targetResults.push(...createSuccessfulWriteResults(target))
        } catch (error) {
          targetResults.push(...createFailureResults(target, error))
        }
      }

      return {
        targets: targetResults,
        ...summarizeResults(targetResults)
      }
    }
  }
}
