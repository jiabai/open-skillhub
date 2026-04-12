import "@testing-library/jest-dom"
import { vi } from "vitest"

// Mock ResizeObserver for tests
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock

vi.mock("@/lib/api", () => {
  return {
    apiBaseUrl: "http://localhost:8000",
    api: {
      sendVerificationCode: vi.fn(async () => ({
        sent: true,
        expires_in: 300,
        resend_interval: 60,
        max_attempts: 5,
        attempts_left: 5
      })),
      register: vi.fn(async () => ({})),
      login: vi.fn(async () => ({ access_token: "token", refresh_token: "refresh" })),
      refresh: vi.fn(async () => ({ access_token: "token", refresh_token: "refresh" })),
      logout: vi.fn(async () => ({})),
      getMe: vi.fn(async () => ({ username: "测试用户", email: "user@example.com", is_superuser: false })),
      updateMe: vi.fn(async () => ({})),
      changePassword: vi.fn(async () => ({})),
      requestDeleteAccount: vi.fn(async () => ({})),
      deleteAccount: vi.fn(async () => ({})),
      listSkills: vi.fn(async () => ({ items: [], total: 0 })),
      listPublicSkills: vi.fn(async () => ({ items: [], total: 0 })),
      createSkill: vi.fn(async () => ({ id: "skill", name: "demo", description: "" })),
      getSkill: vi.fn(async () => ({ id: "skill", name: "demo", description: "" })),
      getPublicSkill: vi.fn(async () => ({ id: "skill", name: "demo", description: "" })),
      updateSkill: vi.fn(async () => ({ id: "skill", name: "demo", description: "" })),
      referencePublicSkill: vi.fn(async () => ({ id: "skill", name: "demo", description: "" })),
      clonePublicSkill: vi.fn(async () => ({ id: "skill", name: "demo-copy", description: "" })),
      downloadSkillRaw: vi.fn(async () => ({
        rawText: '{"skill_uuid":"skill","version":"1.0.0"}',
        payload: {
          skill_uuid: "skill",
          version: "1.0.0",
          encrypted_code: "abc",
          checksum: "sha256:123",
          expires_at: "2026-04-08T00:00:00Z",
          archive_size_bytes: 128,
          encryption_enabled: false,
          download_filename: "skill-skill-1.0.0.json",
          decryption_hint: null,
        },
      })),
      pinReferenceSkillVersion: vi.fn(async () => ({ id: "skill", name: "demo", pinned_version: "1.0.0" })),
      unpinReferenceSkillVersion: vi.fn(async () => ({ id: "skill", name: "demo", pinned_version: null })),
      deleteSkill: vi.fn(async () => ({})),
      activateSkill: vi.fn(async () => ({})),
      deactivateSkill: vi.fn(async () => ({})),
      listSkillVersions: vi.fn(async () => ({
        items: [
          {
            version: "1.2.3",
            description: "demo version",
            dependencies: [],
            dependency_spec: {},
            metadata: {},
            created_at: "2026-04-08T00:00:00Z",
          },
        ],
      })),
      getSkillVersion: vi.fn(async () => ({
        version: "1.2.3",
        description: "demo version",
        dependencies: [],
        dependency_spec: {},
        metadata: {},
        created_at: "2026-04-08T00:00:00Z",
      })),
      rollbackSkillVersion: vi.fn(async () => ({
        version: "1.0.0",
        description: "demo version",
        dependencies: [],
        dependency_spec: {},
        metadata: {},
        created_at: "2026-04-08T00:00:00Z",
      })),
      getInstallInstructions: vi.fn(async () => ({
        strategy: "none",
        dependencies: [],
        requirements_text: "",
        commands: [],
      })),
      listSkillFiles: vi.fn(async () => []),
      getSkillFileContent: vi.fn(async () => "# demo"),
      uploadSkillFile: vi.fn(async () => ({ filename: "SKILL.md" })),
      listTokens: vi.fn(async () => ({ items: [], total: 0 })),
      createToken: vi.fn(async () => ({ id: "token", name: "demo", token: "ask_live_demo" })),
      revokeToken: vi.fn(async () => ({})),
      getDashboardOverview: vi.fn(async () => ({
        active_skills: 3,
        available_tokens: 2,
        success_rate: 99.5,
        success_rate_total: 20,
        success_rate_window_hours: 24
      })),
      getSkillCachePolicy: vi.fn(async () => ({
        cache_ttl_seconds: 300,
        encryption_enabled: false,
        download_encryption_enabled: false,
      })),
      cleanupMetrics: vi.fn(async () => ({ removed: 0, retention_days: 90, cutoff: "2026-03-04T00:00:00Z" })),
      resetMetrics24h: vi.fn(async () => ({
        removed: 0,
        window_hours: 24,
        window_start: "2026-03-03T00:00:00Z",
        window_end: "2026-03-04T00:00:00Z"
      }))
    },
    storeTokens: vi.fn((tokens) => {
      window.localStorage.setItem("skillhub.tokens", JSON.stringify(tokens))
    }),
    clearTokens: vi.fn(() => {
      window.localStorage.removeItem("skillhub.tokens")
    }),
    getStoredTokens: vi.fn(() => {
      const raw = window.localStorage.getItem("skillhub.tokens")
      if (!raw) return null
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    })
  }
})
