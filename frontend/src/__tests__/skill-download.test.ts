import { beforeEach, describe, expect, it, vi } from "vitest"

describe("skill download helpers", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unmock("@/lib/api")
  })

  it("maps common download failures to friendly messages", async () => {
    const { ApiError } = await import("@/lib/api")
    const { getDownloadErrorMessage } = await import("@/lib/skill-download")

    expect(getDownloadErrorMessage(new ApiError("Permission denied", 403, "FORBIDDEN"))).toBe("您没有权限下载此 Skill")
    expect(getDownloadErrorMessage(new ApiError("Not found", 404, "NOT_FOUND"))).toBe("Skill 或版本不存在")
    expect(getDownloadErrorMessage(new ApiError("Gone", 410, "SKILL_DEACTIVATED"))).toBe("该 Skill 已停用，无法下载")
    expect(getDownloadErrorMessage(new TypeError("Failed to fetch"))).toBe("网络错误，请检查连接后重试")
  })

  it("builds encrypted download artifacts with confirmation text", async () => {
    const { buildSkillDownloadArtifact } = await import("@/lib/skill-download")
    const rawText = '{"raw":true}'

    const artifact = buildSkillDownloadArtifact(
      {
        skill_uuid: "skill-1",
        version: "1.0.0",
        encrypted_code: "abc",
        checksum: "sha256:123",
        expires_at: "2026-04-07T00:00:00Z",
        archive_size_bytes: 512,
        encryption_enabled: true,
        download_filename: "skill-skill-1-1.0.0.encrypted.json",
        decryption_hint: "Use the official decryption tool.",
      },
      "skill-1",
      rawText,
    )

    expect(artifact.filename).toBe("skill-skill-1-1.0.0.encrypted.json")
    expect(artifact.confirmMessage).toBe("Use the official decryption tool.")
    expect(artifact.content).toBe(rawText)
  })
})
