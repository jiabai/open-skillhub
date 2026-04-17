import type { AgentAdapterV1, AgentInstallContextV1 } from "@/adapters/agents/base"
import type {
  DesktopSyncState,
  PreparedSkillPackage,
  SkillDistributionRequest,
  SkillDistributionResult,
  SkillDistributionTargetResult,
  StateStore
} from "@/types"

import type { PackageService } from "@/core/distribution/package-service"

export interface DistributionServiceDependencies {
  packageService: PackageService
  stateStore: StateStore
  resolveAgentAdapter(agentId: string): AgentAdapterV1 | null | undefined
  resolveInstallContext(agentId: string): AgentInstallContextV1 | null | undefined
  now?: () => string
}

export interface DistributionService {
  distribute(request: SkillDistributionRequest): Promise<SkillDistributionResult>
}

export interface DistributionNotification {
  title: string
  body: string
  tone: "success" | "warning"
}

function normalizeField(value: string, fieldName: string): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error(`Skill distribution ${fieldName} cannot be empty`)
  }

  if (normalized === "." || normalized === ".." || normalized.includes("/") || normalized.includes("\\")) {
    throw new Error(`Invalid skill distribution ${fieldName}: ${value}`)
  }

  return normalized
}

function createTargetFailure(agentId: string, error: unknown): SkillDistributionTargetResult {
  return {
    agentId,
    success: false,
    errorMessage: error instanceof Error ? error.message : String(error)
  }
}

function createTargetSuccess(agentId: string): SkillDistributionTargetResult {
  return {
    agentId,
    success: true,
    errorMessage: null
  }
}

function updateStateAfterSuccessfulDistribution(
  currentState: DesktopSyncState,
  request: Pick<SkillDistributionRequest, "skillId" | "name" | "version">,
  comparedAt: string
): DesktopSyncState {
  const nextLocalRecords = [...currentState.localRecords]
  const existingRecordIndex = nextLocalRecords.findIndex(
    (record) => record.remoteSkillId === request.skillId
  )
  const nextRecord = {
    remoteSkillId: request.skillId,
    name: request.name,
    installedVersion: request.version,
    remoteVersion: request.version,
    lastComparedAt: comparedAt
  }

  if (existingRecordIndex >= 0) {
    nextLocalRecords[existingRecordIndex] = nextRecord
  } else {
    nextLocalRecords.push(nextRecord)
  }

  return {
    localRecords: nextLocalRecords,
    pendingUpdates: currentState.pendingUpdates.filter(
      (update) => update.remoteSkillId !== request.skillId
    ),
    lastRefreshedAt: currentState.lastRefreshedAt
  }
}

export function createDistributionService(
  dependencies: DistributionServiceDependencies
): DistributionService {
  const now = dependencies.now ?? (() => new Date().toISOString())

  return {
    async distribute(request: SkillDistributionRequest): Promise<SkillDistributionResult> {
      const skillId = normalizeField(request.skillId, "skillId")
      const name = normalizeField(request.name, "name")
      const version = request.version?.trim() || null
      const enabledAgentIds = request.enabledAgentIds.map((agentId) =>
        normalizeField(agentId, "agentId")
      )

      if (enabledAgentIds.length === 0) {
        throw new Error("At least one enabled agent target is required for distribution")
      }

      const preparedPackage: PreparedSkillPackage = await dependencies.packageService.validateAndExtract(
        {
          skillId,
          name,
          version,
          packageSource: request.packageSource
        }
      )

      const targetResults: SkillDistributionTargetResult[] = []
      let allSucceeded = true

      try {
        for (const agentId of enabledAgentIds) {
          const adapter = dependencies.resolveAgentAdapter(agentId)
          const installContext = dependencies.resolveInstallContext(agentId)

          if (!adapter) {
            targetResults.push(
              createTargetFailure(agentId, new Error(`No adapter registered for agent: ${agentId}`))
            )
            allSucceeded = false
            continue
          }

          if (!installContext) {
            targetResults.push(
              createTargetFailure(
                agentId,
                new Error(`No install context available for agent: ${agentId}`)
              )
            )
            allSucceeded = false
            continue
          }

          try {
            const installedSkill = await adapter.installSkill(preparedPackage, installContext)
            const verified = await adapter.verifyInstalledSkill(preparedPackage, installedSkill)

            if (!verified) {
              throw new Error(`Installed skill verification failed for agent: ${agentId}`)
            }

            targetResults.push(createTargetSuccess(agentId))
          } catch (error) {
            targetResults.push(createTargetFailure(agentId, error))
            allSucceeded = false
          }
        }

        if (allSucceeded) {
          const currentState = await dependencies.stateStore.readState()
          const nextState = updateStateAfterSuccessfulDistribution(currentState, {
            skillId,
            name,
            version
          }, now())

          await dependencies.stateStore.writeState(nextState)
        }

        const succeededAgentIds = targetResults
          .filter((result) => result.success)
          .map((result) => result.agentId)
        const failedAgentIds = targetResults
          .filter((result) => !result.success)
          .map((result) => result.agentId)

        return {
          skillId,
          name,
          version,
          extractedPath: preparedPackage.extractedPath,
          targets: targetResults,
          succeededAgentIds,
          failedAgentIds,
          syncedToLocalState: allSucceeded
        }
      } finally {
        await preparedPackage.cleanup()
      }
    }
  }
}

export function createDistributionNotification(
  result: SkillDistributionResult
): DistributionNotification {
  const failedCount = result.failedAgentIds.length
  const succeededCount = result.succeededAgentIds.length

  if (failedCount === 0) {
    return {
      title: "Skill distributed successfully",
      body: `${result.name} was distributed to ${succeededCount} agent target${
        succeededCount === 1 ? "" : "s"
      }.`,
      tone: "success"
    }
  }

  return {
    title: "Skill distribution completed with warnings",
    body: `${result.name} reached ${succeededCount} target${
      succeededCount === 1 ? "" : "s"
    } and failed on ${failedCount}.`,
    tone: "warning"
  }
}
