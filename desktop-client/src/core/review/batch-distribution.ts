import type {
  PendingSyncUpdate,
  PreDistributionCheckSnapshot,
  SkillDistributionResult
} from "@/types"

export type BatchEligibility = "eligible" | "installed" | "blocked"
export type BatchProgress = { completed: number; total: number; currentSkillId: string | null }
export type BatchItemStatus = "succeeded" | "partial" | "failed"
export type BatchItemResult = {
  remoteSkillId: string
  status: BatchItemStatus
  result: SkillDistributionResult | null
  errorMessage: string | null
}
export type BatchDistributionSummary = {
  items: BatchItemResult[]
  succeededCount: number
  partialCount: number
  failedCount: number
}

export function getBatchEligibility(update: PendingSyncUpdate, snapshot: PreDistributionCheckSnapshot | null, isStale: boolean): BatchEligibility {
  if (snapshot === null || isStale || snapshot.globalErrors.length > 0 || snapshot.targetAgentIds.length === 0) return "blocked"
  const targetResults = snapshot.results[update.remoteSkillId]
  if (targetResults === undefined || snapshot.targetAgentIds.some((agentId) => targetResults[agentId] === undefined)) return "blocked"
  const results = snapshot.targetAgentIds.map((agentId) => targetResults[agentId]!)
  if (results.some((result) => result.contentComparison === "error")) return "blocked"
  if (results.every((result) => result.contentComparison === "installed")) return "installed"
  return "eligible"
}

export function createDefaultBatchSelection(updates: PendingSyncUpdate[], snapshot: PreDistributionCheckSnapshot | null, isStale: boolean): string[] {
  return updates.filter((update) => getBatchEligibility(update, snapshot, isStale) === "eligible").map((update) => update.remoteSkillId)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function runDistributionBatch(
  remoteSkillIds: string[],
  distribute: (remoteSkillId: string) => Promise<SkillDistributionResult>,
  onProgress?: (progress: BatchProgress) => void
): Promise<BatchDistributionSummary> {
  const items: BatchItemResult[] = []
  for (const remoteSkillId of remoteSkillIds) {
    onProgress?.({ completed: items.length, total: remoteSkillIds.length, currentSkillId: remoteSkillId })
    try {
      const result = await distribute(remoteSkillId)
      items.push({ remoteSkillId, status: result.failedAgentIds.length > 0 ? "partial" : "succeeded", result, errorMessage: null })
    } catch (error) {
      items.push({ remoteSkillId, status: "failed", result: null, errorMessage: getErrorMessage(error) })
    }
  }
  onProgress?.({ completed: remoteSkillIds.length, total: remoteSkillIds.length, currentSkillId: null })
  return {
    items,
    succeededCount: items.filter((item) => item.status === "succeeded").length,
    partialCount: items.filter((item) => item.status === "partial").length,
    failedCount: items.filter((item) => item.status === "failed").length
  }
}
