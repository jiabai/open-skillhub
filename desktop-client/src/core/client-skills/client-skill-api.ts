import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import type {
  DownloadedSkillArtifact,
  RemoteSkillSummary,
  SkillPackageRequest
} from "@/types"

export type ClientSkillApiErrorCode =
  | "auth-missing"
  | "remote"
  | "invalid-download-payload"
  | "checksum-mismatch"
  | "expired-download"
  | "unsupported-encrypted-download"

export type EncryptedDownloadPolicy = "allow" | "reject"

export interface ClientSkillApiOptions {
  apiBaseUrl: string
  apiToken: string | null
  cacheDirectory: string
  encryptedDownloadPolicy?: EncryptedDownloadPolicy
  fetchImpl?: typeof fetch
  now?: () => Date
}

export interface ClientSkillApi {
  listRemoteSkills(): Promise<RemoteSkillSummary[]>
  downloadSkillArtifact(request: SkillPackageRequest): Promise<DownloadedSkillArtifact>
}

type ClientSkillDownloadPayload = {
  skill_uuid: string
  version: string
  encrypted_code: string
  checksum: string
  expires_at: string
  encryption_enabled: boolean
  download_filename: string
}

export class ClientSkillApiError extends Error {
  readonly code: ClientSkillApiErrorCode

  constructor(code: ClientSkillApiErrorCode, message: string) {
    super(message)
    this.name = "ClientSkillApiError"
    this.code = code
  }
}

function normalizeVersion(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : ""

  return trimmed ? trimmed : null
}

function normalizeContentHash(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : ""

  return trimmed ? trimmed : null
}

function normalizeApiBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "")

  if (!normalized) {
    throw new ClientSkillApiError("remote", "SkillDrive API base URL is required")
  }

  return normalized
}

function createAuthHeaders(apiToken: string | null): Record<string, string> {
  const normalized = apiToken?.trim() ?? ""

  if (!normalized) {
    throw new ClientSkillApiError("auth-missing", "API token is required")
  }

  return {
    Authorization: `Bearer ${normalized}`
  }
}

export function normalizeRemoteSkillSummary(item: unknown): RemoteSkillSummary | null {
  const record = item as Record<string, unknown>
  const versionRecord = record.latest_version as Record<string, unknown> | undefined
  const id = String(
    record.id ?? record.skill_uuid ?? record.skillUuid ?? record.remoteSkillId ?? ""
  ).trim()
  const name = String(record.name ?? "").trim()

  if (!id || !name) {
    return null
  }

  return {
    id,
    name,
    version:
      normalizeVersion(record.version) ??
      normalizeVersion(record.current_version) ??
      normalizeVersion(record.currentVersion) ??
      normalizeVersion(versionRecord?.version),
    contentHash:
      normalizeContentHash(record.content_hash) ??
      normalizeContentHash(record.contentHash) ??
      normalizeContentHash(versionRecord?.content_hash) ??
      normalizeContentHash(versionRecord?.contentHash),
    updatedAt: String(
      record.updatedAt ?? record.updated_at ?? versionRecord?.updated_at ?? new Date().toISOString()
    )
  }
}

function parseListPayload(payload: unknown): RemoteSkillSummary[] {
  const items = Array.isArray((payload as { items?: unknown }).items)
    ? ((payload as { items: unknown[] }).items as unknown[])
    : Array.isArray(payload)
      ? payload
      : []

  return items
    .map(normalizeRemoteSkillSummary)
    .filter((item): item is RemoteSkillSummary => item !== null)
}

function sanitizeCacheSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_")
}

function createPackageArtifactFileName(
  payload: Pick<ClientSkillDownloadPayload, "download_filename" | "encryption_enabled" | "version">,
  request: SkillPackageRequest
): string {
  const sanitizedDownloadFileName = sanitizeCacheSegment(payload.download_filename.trim())

  if (
    sanitizedDownloadFileName &&
    sanitizedDownloadFileName !== "." &&
    sanitizedDownloadFileName !== ".."
  ) {
    return sanitizedDownloadFileName
  }

  return `${sanitizeCacheSegment(request.skillId)}-${sanitizeCacheSegment(payload.version)}${
    payload.encryption_enabled ? ".encrypted.bin" : ".zip"
  }`
}

function computeSha256(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`
}

function assertChecksum(bytes: Buffer, expectedChecksum: string): void {
  if (computeSha256(bytes) !== expectedChecksum.trim().toLowerCase()) {
    throw new ClientSkillApiError(
      "checksum-mismatch",
      "Downloaded skill package checksum verification failed"
    )
  }
}

function assertNotExpired(expiresAt: string, now: () => Date): void {
  const expiresAtMs = Date.parse(expiresAt)

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now().getTime()) {
    throw new ClientSkillApiError("expired-download", "Downloaded skill package has expired")
  }
}

function parseDownloadPayload(payload: unknown): ClientSkillDownloadPayload {
  const record = payload as Record<string, unknown>

  return {
    skill_uuid: String(record.skill_uuid ?? "").trim(),
    version: String(record.version ?? "").trim(),
    encrypted_code: String(record.encrypted_code ?? "").trim(),
    checksum: String(record.checksum ?? "").trim().toLowerCase(),
    expires_at: String(record.expires_at ?? "").trim(),
    encryption_enabled: Boolean(record.encryption_enabled),
    download_filename: String(record.download_filename ?? "").trim()
  }
}

function assertDownloadPayload(payload: ClientSkillDownloadPayload): void {
  if (!payload.skill_uuid || !payload.version || !payload.encrypted_code || !payload.checksum) {
    throw new ClientSkillApiError(
      "invalid-download-payload",
      "Client download response is missing required fields"
    )
  }
}

export function createClientSkillApi(options: ClientSkillApiOptions): ClientSkillApi {
  const apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl)
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? (() => new Date())
  const encryptedDownloadPolicy = options.encryptedDownloadPolicy ?? "allow"

  return {
    async listRemoteSkills(): Promise<RemoteSkillSummary[]> {
      const response = await fetchImpl(`${apiBaseUrl}/api/v1/client/skills`, {
        headers: createAuthHeaders(options.apiToken)
      })

      if (!response.ok) {
        throw new ClientSkillApiError(
          "remote",
          `Failed to load client skills: ${response.status} ${response.statusText}`
        )
      }

      return parseListPayload(await response.json())
    },
    async downloadSkillArtifact(request: SkillPackageRequest): Promise<DownloadedSkillArtifact> {
      const response = await fetchImpl(`${apiBaseUrl}/api/v1/client/skills/download`, {
        method: "POST",
        headers: {
          ...createAuthHeaders(options.apiToken),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          skill_uuid: request.skillId,
          version: request.version
        })
      })

      if (!response.ok) {
        throw new ClientSkillApiError(
          "remote",
          `Failed to download skill package: ${response.status} ${response.statusText}`
        )
      }

      const payload = parseDownloadPayload(await response.json())

      if (payload.encryption_enabled && encryptedDownloadPolicy === "reject") {
        throw new ClientSkillApiError(
          "unsupported-encrypted-download",
          "Encrypted skill downloads are not supported"
        )
      }

      assertDownloadPayload(payload)
      assertNotExpired(payload.expires_at, now)

      const archiveBytes = Buffer.from(payload.encrypted_code, "base64")
      assertChecksum(archiveBytes, payload.checksum)

      await mkdir(options.cacheDirectory, { recursive: true })
      const artifactRoot = await mkdtemp(join(options.cacheDirectory, "package-"))
      const artifactPath = join(artifactRoot, createPackageArtifactFileName(payload, request))

      try {
        await writeFile(artifactPath, archiveBytes)
      } catch (error) {
        await rm(artifactRoot, { recursive: true, force: true })
        throw error
      }

      return {
        artifactPath,
        encrypted: payload.encryption_enabled,
        cleanupPaths: [artifactRoot]
      }
    }
  }
}
