import type { AgentAdapterV1, AgentInstallContextV1 } from "@/adapters/agents/base"
import type {
  DesktopSyncState,
  PreparedSkillPackage,
  SkillDistributionRequest,
  SkillDistributionResult,
  SkillDistributionTarget,
  SkillDistributionTargetResult,
  StateStore
} from "@/types"

import type { PackageService } from "@/core/distribution/package-service"

export interface DistributionServiceDependencies {
  packageService: PackageService
  stateStore: StateStore
  resolveAgentAdapter(agentId: string): AgentAdapterV1 | null | undefined
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

function normalizeTargetPath(value: string): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error("Skill distribution targetPath cannot be empty")
  }

  return normalized
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

function updateStateAfterSuccessfulDistribution(
  currentState: DesktopSyncState,
  request: Pick<SkillDistributionRequest, "skillId" | "name" | "version" | "contentHash">,
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
    installedContentHash: request.contentHash,
    remoteVersion: request.version,
    remoteContentHash: request.contentHash,
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
    successfulDistributionCount: currentState.successfulDistributionCount + 1,
    lastRefreshedAt: currentState.lastRefreshedAt
  }
}

function normalizeDistributionTarget(target: SkillDistributionTarget): SkillDistributionTarget {
  const primaryAgentId = normalizeField(
    target.primaryAgentId,
    "primaryAgentId"
  ) as SkillDistributionTarget["primaryAgentId"]
  const coveredAgentIds = target.coveredAgentIds.map((agentId) =>
    normalizeField(agentId, "coveredAgentId")
  ) as SkillDistributionTarget["coveredAgentIds"]
  const targetPath = normalizeTargetPath(target.targetPath)

  if (coveredAgentIds.length === 0) {
    throw new Error("Skill distribution target must cover at least one agent")
  }

  return {
    ...target,
    adapterAgentId: target.adapterAgentId?.trim() || undefined,
    primaryAgentId,
    coveredAgentIds,
    targetPath,
    writeMode: target.writeMode ?? "write"
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

export function createDistributionService(
  dependencies: DistributionServiceDependencies
): DistributionService {
  const now = dependencies.now ?? (() => new Date().toISOString())

  return {
    async distribute(request: SkillDistributionRequest): Promise<SkillDistributionResult> {
      const skillId = normalizeField(request.skillId, "skillId")
      const name = normalizeField(request.name, "name")
      const version = request.version?.trim() || null
      const contentHash = request.contentHash?.trim() || null
      const targets = request.targets.map(normalizeDistributionTarget)

      if (targets.length === 0) {
        throw new Error("At least one enabled agent target is required for distribution")
      }

      const targetResults: SkillDistributionTargetResult[] = []
      const writeTargets = targets.filter((target) => target.writeMode !== "skip-installed-content")
      let preparedPackage: PreparedSkillPackage | null = null

      for (const target of targets) {
        if (target.writeMode === "skip-installed-content") {
          targetResults.push(...createSkipResults(target))
        }
      }

      if (writeTargets.length > 0) {
        preparedPackage = await dependencies.packageService.validateAndExtract({
          skillId,
          name,
          version,
          packageSource: request.packageSource
        })
      }

      let allSucceeded = true

      try {
        for (const target of writeTargets) {
          const adapterAgentId = target.adapterAgentId ?? target.primaryAgentId
          const adapter = dependencies.resolveAgentAdapter(adapterAgentId)
          const installContext: AgentInstallContextV1 = {
            skillsPath: target.targetPath
          }

          if (!adapter) {
            targetResults.push(
              ...createFailureResults(
                target,
                new Error(`No adapter registered for agent: ${adapterAgentId}`),
                target.adapterAgentId
              )
            )
            allSucceeded = false
            continue
          }

          try {
            if (!preparedPackage) {
              throw new Error("Prepared package unavailable for write target")
            }

            const installedSkill = await adapter.installSkill(preparedPackage, installContext)
            const verified = await adapter.verifyInstalledSkill(preparedPackage, installedSkill)

            if (!verified) {
              throw new Error(`Installed skill verification failed for agent: ${adapterAgentId}`)
            }

            targetResults.push(...createSuccessfulWriteResults(target))
          } catch (error) {
            targetResults.push(...createFailureResults(target, error))
            allSucceeded = false
          }
        }

        if (allSucceeded) {
          const currentState = await dependencies.stateStore.readState()
          const nextState = updateStateAfterSuccessfulDistribution(currentState, {
            skillId,
            name,
            version,
            contentHash
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
          extractedPath: preparedPackage?.extractedPath ?? null,
          targets: targetResults,
          succeededAgentIds,
          failedAgentIds,
          syncedToLocalState: allSucceeded
        }
      } finally {
        await preparedPackage?.cleanup()
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
