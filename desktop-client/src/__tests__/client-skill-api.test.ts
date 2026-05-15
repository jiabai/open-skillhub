import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ClientSkillApiError,
  createClientSkillApi
} from "@/core/client-skills/client-skill-api"

describe("client skill API", () => {
  const tempRoots: string[] = []

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()

      if (root) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  function createTempRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "skilldrive-client-api-"))
    tempRoots.push(root)
    return root
  }

  function checksum(bytes: Buffer): string {
    return `sha256:${createHash("sha256").update(bytes).digest("hex")}`
  }

  it("normalizes client skill list responses", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              skill_uuid: "skill-1",
              name: "Skill One",
              latest_version: {
                version: "1.2.3",
                content_hash: "hash-1",
                updated_at: "2026-05-14T01:00:00.000Z"
              }
            },
            {
              id: "skill-2",
              name: "Skill Two",
              currentVersion: "2.0.0",
              contentHash: "hash-2",
              updatedAt: "2026-05-14T02:00:00.000Z"
            },
            {
              id: "",
              name: "Ignored"
            }
          ]
        }),
        { status: 200 }
      )
    )
    const api = createClientSkillApi({
      apiBaseUrl: "https://skilldrive.test",
      apiToken: "token",
      cacheDirectory: createTempRoot(),
      fetchImpl
    })

    await expect(api.listRemoteSkills()).resolves.toEqual([
      {
        id: "skill-1",
        name: "Skill One",
        version: "1.2.3",
        contentHash: "hash-1",
        updatedAt: "2026-05-14T01:00:00.000Z"
      },
      {
        id: "skill-2",
        name: "Skill Two",
        version: "2.0.0",
        contentHash: "hash-2",
        updatedAt: "2026-05-14T02:00:00.000Z"
      }
    ])
    expect(fetchImpl).toHaveBeenCalledWith("https://skilldrive.test/api/v1/client/skills", {
      headers: {
        Authorization: "Bearer token"
      }
    })
  })

  it("downloads packages with checksum and expiration validation", async () => {
    const cacheDirectory = createTempRoot()
    const archiveBytes = Buffer.from("zip bytes")
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          skill_uuid: "skill-1",
          version: "1.2.3",
          encrypted_code: archiveBytes.toString("base64"),
          checksum: checksum(archiveBytes),
          expires_at: "2026-05-15T00:00:00.000Z",
          encryption_enabled: false,
          download_filename: "skill-one.zip"
        }),
        { status: 200 }
      )
    )
    const api = createClientSkillApi({
      apiBaseUrl: "https://skilldrive.test",
      apiToken: "token",
      cacheDirectory,
      fetchImpl,
      now: () => new Date("2026-05-14T00:00:00.000Z")
    })

    const artifact = await api.downloadSkillArtifact({
      skillId: "skill-1",
      name: "Skill One",
      version: "1.2.3",
      packageSource: { source: "test" }
    })

    expect(artifact.encrypted).toBe(false)
    expect(readFileSync(artifact.artifactPath)).toEqual(archiveBytes)
    expect(artifact.artifactPath.endsWith("skill-one.zip")).toBe(true)
    expect(artifact.cleanupPaths).toHaveLength(1)
    expect(existsSync(artifact.cleanupPaths?.[0] ?? "")).toBe(true)
  })

  it("stores unencrypted decoded downloads as zip files even when the backend filename is json", async () => {
    const cacheDirectory = createTempRoot()
    const archiveBytes = Buffer.from("zip bytes")
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          skill_uuid: "skill-1",
          version: "1.0.0",
          encrypted_code: archiveBytes.toString("base64"),
          checksum: checksum(archiveBytes),
          expires_at: "2026-05-15T00:00:00.000Z",
          encryption_enabled: false,
          download_filename: "skill-d2551f13-1.0.0.json"
        }),
        { status: 200 }
      )
    )
    const api = createClientSkillApi({
      apiBaseUrl: "https://skilldrive.test",
      apiToken: "token",
      cacheDirectory,
      fetchImpl,
      now: () => new Date("2026-05-14T00:00:00.000Z")
    })

    const artifact = await api.downloadSkillArtifact({
      skillId: "skill-d2551f13",
      name: "Skill One",
      version: "1.0.0",
      packageSource: { source: "test" }
    })

    expect(artifact.encrypted).toBe(false)
    expect(readFileSync(artifact.artifactPath)).toEqual(archiveBytes)
    expect(artifact.artifactPath.endsWith("skill-d2551f13-1.0.0.zip")).toBe(true)
  })

  it("rejects mismatched checksums", async () => {
    const archiveBytes = Buffer.from("zip bytes")
    const api = createClientSkillApi({
      apiBaseUrl: "https://skilldrive.test",
      apiToken: "token",
      cacheDirectory: createTempRoot(),
      fetchImpl: vi.fn(async () =>
        new Response(
          JSON.stringify({
            skill_uuid: "skill-1",
            version: "1.2.3",
            encrypted_code: archiveBytes.toString("base64"),
            checksum: "sha256:not-the-hash",
            expires_at: "2026-05-15T00:00:00.000Z",
            encryption_enabled: false,
            download_filename: "skill-one.zip"
          }),
          { status: 200 }
        )
      ),
      now: () => new Date("2026-05-14T00:00:00.000Z")
    })

    await expect(
      api.downloadSkillArtifact({
        skillId: "skill-1",
        name: "Skill One",
        version: "1.2.3",
        packageSource: { source: "test" }
      })
    ).rejects.toMatchObject(
      new ClientSkillApiError("checksum-mismatch", "Downloaded skill package checksum verification failed")
    )
  })

  it("rejects expired downloads", async () => {
    const archiveBytes = Buffer.from("zip bytes")
    const api = createClientSkillApi({
      apiBaseUrl: "https://skilldrive.test",
      apiToken: "token",
      cacheDirectory: createTempRoot(),
      fetchImpl: vi.fn(async () =>
        new Response(
          JSON.stringify({
            skill_uuid: "skill-1",
            version: "1.2.3",
            encrypted_code: archiveBytes.toString("base64"),
            checksum: checksum(archiveBytes),
            expires_at: "2026-05-13T00:00:00.000Z",
            encryption_enabled: false,
            download_filename: "skill-one.zip"
          }),
          { status: 200 }
        )
      ),
      now: () => new Date("2026-05-14T00:00:00.000Z")
    })

    await expect(
      api.downloadSkillArtifact({
        skillId: "skill-1",
        name: "Skill One",
        version: "1.2.3",
        packageSource: { source: "test" }
      })
    ).rejects.toMatchObject(
      new ClientSkillApiError("expired-download", "Downloaded skill package has expired")
    )
  })

  it("can reject encrypted downloads before staging files", async () => {
    const cacheDirectory = createTempRoot()
    const archiveBytes = Buffer.from("encrypted bytes")
    const api = createClientSkillApi({
      apiBaseUrl: "https://skilldrive.test",
      apiToken: "token",
      cacheDirectory,
      fetchImpl: vi.fn(async () =>
        new Response(
          JSON.stringify({
            skill_uuid: "skill-1",
            version: "1.2.3",
            encrypted_code: archiveBytes.toString("base64"),
            checksum: checksum(archiveBytes),
            expires_at: "2026-05-15T00:00:00.000Z",
            encryption_enabled: true,
            download_filename: "skill-one.encrypted.bin"
          }),
          { status: 200 }
        )
      ),
      encryptedDownloadPolicy: "reject",
      now: () => new Date("2026-05-14T00:00:00.000Z")
    })

    await expect(
      api.downloadSkillArtifact({
        skillId: "skill-1",
        name: "Skill One",
        version: "1.2.3",
        packageSource: { source: "test" }
      })
    ).rejects.toMatchObject(
      new ClientSkillApiError("unsupported-encrypted-download", "Encrypted skill downloads are not supported")
    )
    expect(existsSync(join(cacheDirectory, "skill-one.encrypted.bin"))).toBe(false)
  })
})
