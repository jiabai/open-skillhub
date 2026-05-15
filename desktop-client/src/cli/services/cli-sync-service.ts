import { rm } from "node:fs/promises"

import { prepareCliLocalPackageSource } from "@/cli/services/cli-package-source"
import { CliError } from "@/cli/services/cli-errors"
import type { CliSyncScope, CliSyncStateStore } from "@/cli/services/cli-sync-state"
import type { CliDistributionScope, CliDistributionTarget } from "@/cli/services/cli-targets"
import {
  ClientSkillApiError,
  createClientSkillApi
} from "@/core/client-skills/client-skill-api"
import type { DownloadedSkillArtifact, PreparedSkillPackage, RemoteSkillSummary } from "@/types"

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

async function cleanupDownloadedArtifact(artifact: DownloadedSkillArtifact): Promise<void> {
  for (const cleanupPath of artifact.cleanupPaths ?? []) {
    await rm(cleanupPath, { recursive: true, force: true })
  }
}

function toCliApiError(action: "list" | "download", error: unknown): never {
  if (error instanceof ClientSkillApiError) {
    if (error.code === "unsupported-encrypted-download") {
      throw new CliError(
        "unsupported-encrypted-download",
        "encrypted downloads not supported by Linux CLI v1"
      )
    }

    const message =
      error.code === "auth-missing"
        ? "API token is required for sync"
        : error.message.replace("Failed to load client skills", "Failed to list server skills")

    throw new CliError("remote", action === "download" ? `Failed to download skill package: ${message}` : message)
  }

  throw error
}

export function createHttpCliSyncApiClient(options: HttpCliSyncApiClientOptions): CliSyncApiClient {
  const fetchImpl = options.fetchImpl ?? fetch

  return {
    async listClientSkills(): Promise<RemoteSkillSummary[]> {
      try {
        return await createClientSkillApi({
          apiBaseUrl: options.apiBaseUrl,
          apiToken: options.apiToken,
          cacheDirectory: options.cacheDir,
          fetchImpl
        }).listRemoteSkills()
      } catch (error) {
        toCliApiError("list", error)
      }
    },
    async downloadSkillPackage(
      skill: RemoteSkillSummary,
      downloadOptions: CliSyncDownloadOptions = { cacheDir: options.cacheDir }
    ): Promise<PreparedSkillPackage> {
      let artifact: DownloadedSkillArtifact | null = null
      try {
        artifact = await createClientSkillApi({
          apiBaseUrl: options.apiBaseUrl,
          apiToken: options.apiToken,
          cacheDirectory: downloadOptions.cacheDir,
          encryptedDownloadPolicy: "reject",
          fetchImpl
        }).downloadSkillArtifact({
          skillId: skill.id,
          name: skill.name,
          version: skill.version,
          packageSource: { source: "client-download" }
        })
        const prepared = await prepareCliLocalPackageSource({
          sourcePath: artifact.artifactPath,
          cacheDir: downloadOptions.cacheDir
        })

        return {
          ...prepared,
          skillId: skill.id,
          name: skill.name,
          version: skill.version,
          async cleanup(): Promise<void> {
            await prepared.cleanup()
            if (artifact) {
              await cleanupDownloadedArtifact(artifact)
            }
          }
        }
      } catch (error) {
        if (artifact) {
          await cleanupDownloadedArtifact(artifact)
        }
        toCliApiError("download", error)
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
