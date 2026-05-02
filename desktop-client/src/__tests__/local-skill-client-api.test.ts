import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { uploadLocalSkillPackage } from "@/core/local-skills/local-skill-client-api"

const tempRoots: string[] = []

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "skilldrive-local-api-test-"))
  tempRoots.push(root)
  return root
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe("uploadLocalSkillPackage", () => {
  it("posts a local ZIP to the Client API upload route with API token auth", async () => {
    const root = createTempRoot()
    const artifactPath = join(root, "local-only.zip")
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 201,
      statusText: "Created",
      json: async () => ({
        id: "skill-id",
        name: "local-only",
        version: "1.0.0",
        current_version: "1.0.0"
      })
    }))
    writeFileSync(artifactPath, Buffer.from("zip-bytes"))

    const result = await uploadLocalSkillPackage({
      apiBaseUrl: "http://localhost:8001/",
      apiToken: "ask_live_token",
      artifactPath,
      fileName: "local-only.zip",
      fetchImpl
    })

    expect(result).toEqual({
      id: "skill-id",
      name: "local-only",
      version: "1.0.0"
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][0]).toBe("http://localhost:8001/api/v1/client/skills/upload")
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer ask_live_token"
      }
    })
    expect(fetchImpl.mock.calls[0][1]?.body).toBeInstanceOf(FormData)
  })

  it("keeps backend error codes in upload failures", async () => {
    const root = createTempRoot()
    const artifactPath = join(root, "duplicate.zip")
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 409,
      statusText: "Conflict",
      json: async () => ({
        detail: "Skill already exists",
        code: "SKILL_ALREADY_EXISTS"
      })
    }))
    writeFileSync(artifactPath, Buffer.from("zip-bytes"))

    await expect(
      uploadLocalSkillPackage({
        apiBaseUrl: "http://localhost:8001",
        apiToken: "ask_live_token",
        artifactPath,
        fileName: "duplicate.zip",
        fetchImpl
      })
    ).rejects.toThrow("SKILL_ALREADY_EXISTS: Skill already exists")
  })
})
