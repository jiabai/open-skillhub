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

function createLocalRecord(
  remoteSkill: RemoteSkillSummary,
  comparedAt: string,
  existingRecord?: LocalDistributedSkillRecord
): LocalDistributedSkillRecord {
  return {
    remoteSkillId: remoteSkill.id,
    name: remoteSkill.name,
    installedVersion: existingRecord?.installedVersion ?? null,
    remoteVersion: normalizeVersion(remoteSkill.version),
    lastComparedAt: comparedAt
  }
}

function createPendingUpdate(
  remoteSkill: RemoteSkillSummary,
  localVersion: string | null,
  remoteVersion: string
): PendingSyncUpdate {
  return {
    remoteSkillId: remoteSkill.id,
    name: remoteSkill.name,
    localVersion,
    remoteVersion,
    reason: localVersion === null ? "missing-local-record" : "version-mismatch"
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
    const localRecord = localByRemoteId.get(remoteSkill.id)
    const nextRecord = createLocalRecord(remoteSkill, comparedAt, localRecord)
    const localVersion = localRecord?.installedVersion ?? null

    nextLocalRecords.push(nextRecord)

    let status: SyncComparisonItem["status"] = "in-sync"

    if (remoteVersion === null) {
      status = "in-sync"
    } else if (localVersion === null) {
      status = "install"
      pendingUpdates.push(createPendingUpdate(remoteSkill, null, remoteVersion))
    } else if (localVersion !== remoteVersion) {
      status = "update"
      pendingUpdates.push(createPendingUpdate(remoteSkill, localVersion, remoteVersion))
    }

    items.push({
      remoteSkillId: remoteSkill.id,
      name: remoteSkill.name,
      localVersion,
      remoteVersion,
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
    lastRefreshedAt: null
  }
}
