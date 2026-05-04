import type {
  DesktopSyncState,
  LocalDistributedSkillRecord,
  PendingSyncUpdate,
  RemoteSkillSummary,
  SyncComparisonItem,
  SyncComparisonResult
} from "@/types"

function normalizeVersion(version: string | null | undefined): string | null {
  const trimmed = version?.trim()
  return trimmed ? trimmed : null
}

function normalizeHash(contentHash: string | null | undefined): string | null {
  const trimmed = contentHash?.trim()
  return trimmed ? trimmed : null
}

function createLocalRecord(
  remoteSkill: RemoteSkillSummary,
  comparedAt: string,
  existingRecord?: LocalDistributedSkillRecord
): LocalDistributedSkillRecord {
  return {
    remoteSkillId: remoteSkill.id,
    name: remoteSkill.name,
    installedVersion: existingRecord?.installedVersion ?? null,
    installedContentHash: existingRecord?.installedContentHash ?? null,
    remoteVersion: normalizeVersion(remoteSkill.version),
    remoteContentHash: normalizeHash(remoteSkill.contentHash),
    lastComparedAt: comparedAt
  }
}

function createPendingUpdate(
  remoteSkill: RemoteSkillSummary,
  localVersion: string | null,
  localContentHash: string | null,
  remoteVersion: string,
  remoteContentHash: string | null,
  reason: PendingSyncUpdate["reason"]
): PendingSyncUpdate {
  return {
    remoteSkillId: remoteSkill.id,
    name: remoteSkill.name,
    localVersion,
    localContentHash,
    remoteVersion,
    remoteContentHash,
    reason
  }
}

export function compareRemoteSkills(
  remoteSkills: RemoteSkillSummary[],
  localRecords: LocalDistributedSkillRecord[],
  comparedAt = new Date().toISOString()
): SyncComparisonResult {
  const localByRemoteId = new Map(
    localRecords.map((record) => [record.remoteSkillId, record] as const)
  )
  const nextLocalRecords: LocalDistributedSkillRecord[] = []
  const items: SyncComparisonItem[] = []
  const pendingUpdates: PendingSyncUpdate[] = []

  for (const remoteSkill of remoteSkills) {
    const remoteVersion = normalizeVersion(remoteSkill.version)
    const remoteContentHash = normalizeHash(remoteSkill.contentHash)
    const localRecord = localByRemoteId.get(remoteSkill.id)
    const nextRecord = createLocalRecord(remoteSkill, comparedAt, localRecord)
    const localVersion = localRecord?.installedVersion ?? null
    const localContentHash = localRecord?.installedContentHash ?? null

    nextLocalRecords.push(nextRecord)

    let status: SyncComparisonItem["status"] = "installed"

    if (remoteVersion === null) {
      status = "installed"
    } else if (!localRecord) {
      status = "not-installed"
      pendingUpdates.push(
        createPendingUpdate(remoteSkill, null, null, remoteVersion, remoteContentHash, "not-installed")
      )
    } else if (remoteContentHash === null) {
      status = "installed"
    } else if (localContentHash === null || localContentHash !== remoteContentHash) {
      status = "update"
      pendingUpdates.push(
        createPendingUpdate(
          remoteSkill,
          localVersion,
          localContentHash,
          remoteVersion,
          remoteContentHash,
          "update"
        )
      )
    }

    items.push({
      remoteSkillId: remoteSkill.id,
      name: remoteSkill.name,
      localVersion,
      localContentHash,
      remoteVersion,
      remoteContentHash,
      status
    })
  }

  for (const localRecord of localRecords) {
    if (!remoteSkills.some((remoteSkill) => remoteSkill.id === localRecord.remoteSkillId)) {
      nextLocalRecords.push(localRecord)
    }
  }

  return {
    items,
    localRecords: nextLocalRecords,
    pendingUpdates,
    comparedAt
  }
}

export function createEmptySyncState(): DesktopSyncState {
  return {
    localRecords: [],
    pendingUpdates: [],
    successfulDistributionCount: 0,
    lastRefreshedAt: null
  }
}
