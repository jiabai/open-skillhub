import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { prepareCliLocalPackageSource } from "@/cli/services/cli-package-source"
import { CliError } from "@/cli/services/cli-errors"
import type { CliSyncScope, CliSyncStateStore } from "@/cli/services/cli-sync-state"
import type { CliDistributionScope, CliDistributionTarget } from "@/cli/services/cli-targets"
import type { PreparedSkillPackage, RemoteSkillSummary } from "@/types"

export interface CliSyncDownloadOptions {
  cacheDir: string
}

export interface CliSyncApiClient {
  listClientSkills(): Promise<RemoteSkillSummary[]>
  downloadSkillPackage(
    skill: RemoteSkillSummary,
    options: CliSyncDownloadOptions
  ): Promise<PreparedSkillPackage>
}

export interface HttpCliSyncApiClientOptions {
  apiBaseUrl: string
  apiToken: string
  cacheDir: string
  fetchImpl?: typeof fetch
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function toCliSyncScope(scope: CliDistributionScope): CliSyncScope {
  if (scope.type === "global") {
    return {
      scopeType: "global",
      scopeKey: "global"
    }
  }

  return {
    scopeType: "project",
    scopeKey: scope.projectPath
  }
}

export async function createTrackedRemoteSkillIdsByTargetKey(
  stateStore: CliSyncStateStore,
  scope: CliSyncScope
): Promise<Map<string, Set<string>>> {
  const records = await stateStore.listRecords(scope)
  const tracked = new Map<string, Set<string>>()

  for (const record of records) {
    const remoteSkillIds = tracked.get(record.targetKey) ?? new Set<string>()
    remoteSkillIds.add(record.remoteSkillId)
    tracked.set(record.targetKey, remoteSkillIds)
  }

  return tracked
}

export async function selectRemoteSkillsForSync(args: {
  remoteSkills: RemoteSkillSummary[]
  targets: CliDistributionTarget[]
  stateStore: CliSyncStateStore
  scope: CliSyncScope
  all?: boolean
}): Promise<RemoteSkillSummary[]> {
  if (args.all) {
    return args.remoteSkills
  }

  const records = await args.stateStore.listRecords(args.scope)
  const recordsByTargetAndSkill = new Map(
    records.map((record) => [`${record.targetKey}\0${record.remoteSkillId}`, record] as const)
  )

  return args.remoteSkills.filter((skill) =>
    args.targets.some((target) => {
      const record = recordsByTargetAndSkill.get(`${target.targetKey}\0${skill.id}`)

      if (!record) {
        return true
      }

      if (skill.contentHash && record.installedContentHash !== skill.contentHash) {
        return true
      }

      return false
    })
  )
}

function normalizeSkillSummary(item: unknown): RemoteSkillSummary | null {
  const record = item as Record<string, unknown>
  const versionRecord = record.latest_version as Record<string, unknown> | undefined
  const id = String(record.id ?? record.skill_uuid ?? record.skillUuid ?? "").trim()
  const name = String(record.name ?? "").trim()

  if (!id || !name) {
    return null
  }

  return {
    id,
    name,
    version: String(record.version ?? record.current_version ?? versionRecord?.version ?? "").trim() || null,
    contentHash:
      String(record.content_hash ?? record.contentHash ?? versionRecord?.content_hash ?? "").trim() ||
      null,
    updatedAt: String(record.updatedAt ?? record.updated_at ?? versionRecord?.updated_at ?? new Date().toISOString())
  }
}

function computeSha256(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`
}

function assertChecksum(bytes: Buffer, checksum: string): void {
  const normalized = checksum.trim().toLowerCase()

  if (normalized && computeSha256(bytes) !== normalized) {
    throw new CliError("remote", "Downloaded skill package checksum verification failed")
  }
}

function createAuthHeaders(apiToken: string): Record<string, string> {
  if (!apiToken.trim()) {
    throw new CliError("remote", "API token is required for sync")
  }

  return {
    Authorization: `Bearer ${apiToken}`
  }
}

export function createHttpCliSyncApiClient(options: HttpCliSyncApiClientOptions): CliSyncApiClient {
  const fetchImpl = options.fetchImpl ?? fetch

  return {
    async listClientSkills(): Promise<RemoteSkillSummary[]> {
      const response = await fetchImpl(`${options.apiBaseUrl}/api/v1/client/skills`, {
        headers: createAuthHeaders(options.apiToken)
      })

      if (!response.ok) {
        throw new CliError("remote", `Failed to list server skills: ${response.status} ${response.statusText}`)
      }

      const payload = (await response.json()) as unknown
      const items = Array.isArray((payload as { items?: unknown }).items)
        ? ((payload as { items: unknown[] }).items as unknown[])
        : Array.isArray(payload)
          ? payload
          : []

      return items.map(normalizeSkillSummary).filter((item): item is RemoteSkillSummary => item !== null)
    },
    async downloadSkillPackage(skill: RemoteSkillSummary): Promise<PreparedSkillPackage> {
      const response = await fetchImpl(`${options.apiBaseUrl}/api/v1/client/skills/download`, {
        method: "POST",
        headers: {
          ...createAuthHeaders(options.apiToken),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          skill_uuid: skill.id,
          version: skill.version
        })
      })
      const payload = (await response.json()) as Record<string, unknown>

      if (!response.ok) {
        throw new CliError("remote", `Failed to download skill package: ${response.status} ${response.statusText}`)
      }

      if (Boolean(payload.encryption_enabled)) {
        throw new CliError(
          "unsupported-encrypted-download",
          "encrypted downloads not supported by Linux CLI v1"
        )
      }

      const encoded = String(payload.encrypted_code ?? "").trim()

      if (!encoded) {
        throw new CliError("remote", "Client download response is missing package bytes")
      }

      const archiveBytes = Buffer.from(encoded, "base64")
      assertChecksum(archiveBytes, String(payload.checksum ?? ""))

      await mkdir(options.cacheDir, { recursive: true })
      const artifactRoot = await mkdtemp(join(options.cacheDir, "package-"))
      const archivePath = join(artifactRoot, String(payload.download_filename ?? `${skill.id}.zip`).trim() || `${skill.id}.zip`)

      try {
        await writeFile(archivePath, archiveBytes)
        const prepared = await prepareCliLocalPackageSource({
          sourcePath: archivePath,
          cacheDir: options.cacheDir
        })

        return {
          ...prepared,
          skillId: skill.id,
          name: skill.name,
          version: skill.version,
          async cleanup(): Promise<void> {
            await prepared.cleanup()
            await rm(artifactRoot, { recursive: true, force: true })
          }
        }
      } catch (error) {
        await rm(artifactRoot, { recursive: true, force: true })
        throw error
      }
    }
  }
}

export function normalizeRemoteError(prefix: string, error: unknown): never {
  if (error instanceof CliError) {
    throw error
  }

  throw new CliError("remote", `${prefix}: ${getErrorMessage(error)}`)
}
