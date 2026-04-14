import { beforeEach, describe, expect, it, vi } from "vitest"

type FetchResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}

const createResponse = (status: number, body: unknown): FetchResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => typeof body === "string" ? body : JSON.stringify(body),
})

describe("download api", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unmock("@/lib/api")
    window.localStorage.clear()
  })

  it("passes AbortSignal to download requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse(200, {
      skill_uuid: "skill-1",
      version: "1.0.0",
      encrypted_code: "abc",
      checksum: "sha256:123",
      expires_at: "2026-04-07T00:00:00Z",
      archive_size_bytes: 12,
      encryption_enabled: false,
      download_filename: "skill-skill-1-1.0.0.json",
    }))
    vi.stubGlobal("fetch", fetchMock)

    const { api } = await import("@/lib/api")
    const controller = new AbortController()
    await api.downloadSkill({ skill_uuid: "skill-1", version: "1.0.0", signal: controller.signal })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(options.signal).toBe(controller.signal)
    expect(options.body).toBe(JSON.stringify({ skill_uuid: "skill-1", version: "1.0.0" }))
  })

  it("returns raw response text for download artifact saving", async () => {
    const rawText = JSON.stringify({
      skill_uuid: "skill-1",
      version: "1.0.0",
      encrypted_code: "abc",
      checksum: "sha256:123",
      expires_at: "2026-04-07T00:00:00Z",
      archive_size_bytes: 12,
      encryption_enabled: false,
      download_filename: "skill-skill-1-1.0.0.json",
    })
    const fetchMock = vi.fn().mockResolvedValue(createResponse(200, rawText))
    vi.stubGlobal("fetch", fetchMock)

    const { api } = await import("@/lib/api")
    const result = await api.downloadSkillRaw({ skill_uuid: "skill-1", version: "1.0.0" })

    expect(result.rawText).toBe(rawText)
    expect(result.payload.download_filename).toBe("skill-skill-1-1.0.0.json")
  })

  it("throws ApiError with status and code for download failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse(410, {
      detail: { detail: "Skill deactivated", code: "SKILL_DEACTIVATED" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const { api, ApiError } = await import("@/lib/api")

    await expect(api.downloadSkill({ skill_uuid: "skill-1" })).rejects.toEqual(
      expect.objectContaining({
        name: "ApiError",
        message: "Skill deactivated",
        status: 410,
        code: "SKILL_DEACTIVATED",
      }),
    )
  })
})
