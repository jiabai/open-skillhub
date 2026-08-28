import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { createLocalSkillInventoryService } from "@/core/local-skills/local-skill-inventory-service"
import type { AgentDetectionSnapshot, RemoteSkillSummary } from "@/types"

const tempRoots: string[] = []

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "skilldrive-local-skills-test-"))
  tempRoots.push(root)
  return root
}

function writeSkill(root: string, directoryName: string, frontmatter: string): string {
  const skillDir = join(root, directoryName)
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, "SKILL.md"), `---\n${frontmatter}\n---\n# ${directoryName}`)
  writeFileSync(join(skillDir, "README.md"), "body")
  return skillDir
}

function createDetectionSnapshot(targetPath: string): AgentDetectionSnapshot {
  return {
    checkedAt: "2026-05-02T00:00:00.000Z",
    supportedAgentCount: 3,
    installedAgentIds: ["codex", "cline"],
    agentStatuses: [
      {
        agentId: "codex",
        displayName: "Codex",
        installed: true,
        source: "auto-detected",
        detectionDirs: [],
        targetPaths: [targetPath],
        compatibleReadPaths: [],
        reason: null
      },
      {
        agentId: "cline",
        displayName: "Cline",
        installed: true,
        source: "auto-detected",
        detectionDirs: [],
        targetPaths: [targetPath],
        compatibleReadPaths: [],
        reason: null
      },
      {
        agentId: "gemini-cli",
        displayName: "Gemini CLI",
        installed: false,
        source: "missing",
        detectionDirs: [],
        targetPaths: [],
        compatibleReadPaths: [],
        reason: "No detection directory found."
      }
    ],
    uniqueTargets: [
      {
        targetId: "shared-target",
        targetPath,
        primaryAgentId: "codex",
        coveredAgentIds: ["codex", "cline"],
        sharedPathKey: "agents-universal",
        source: "auto-detected"
      }
    ]
  }
}

function createCategorizedDetectionSnapshot(targetPath: string): AgentDetectionSnapshot {
  const snapshot = createDetectionSnapshot(targetPath)

  return {
    ...snapshot,
    installedAgentIds: ["hermes"],
    agentStatuses: [
      {
        agentId: "hermes",
        displayName: "Hermes Agent",
        installed: true,
        source: "auto-detected",
        detectionDirs: [],
        targetPaths: [targetPath],
        compatibleReadPaths: [],
        reason: null
      }
    ],
    uniqueTargets: [
      {
        targetId: "hermes-target",
        targetPath,
        primaryAgentId: "hermes",
        coveredAgentIds: ["hermes"],
        sharedPathKey: null,
        source: "auto-detected",
        skillLayout: {
          mode: "categorized",
          categoryDepth: 1,
          defaultCategory: "general",
          categorySource: "agent-default"
        }
      }
    ]
  }
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe("createLocalSkillInventoryService", () => {
  it("scans direct local skill roots and matches server skills by exact SKILL name", async () => {
    const targetPath = createTempRoot()
    const existingPath = writeSkill(targetPath, "existing-dir", "name: server-skill\nversion: 1.0.0")
    const missingPath = writeSkill(targetPath, "missing-dir", "name: local-only\nversion: 0.1.0")
    const remoteSkills: RemoteSkillSummary[] = [
      {
        id: "remote-server-skill",
        name: "server-skill",
        version: "2.0.0",
        contentHash: "hash-server-skill",
        updatedAt: "2026-05-02T00:00:00.000Z"
      },
      {
        id: "case-mismatch",
        name: "LOCAL-ONLY",
        version: "9.9.9",
        contentHash: "hash-case-mismatch",
        updatedAt: "2026-05-02T00:00:00.000Z"
      }
    ]

    const snapshot = await createLocalSkillInventoryService({
      now: () => new Date("2026-05-02T01:00:00.000Z")
    }).refresh({
      detectionSnapshot: createDetectionSnapshot(targetPath),
      remoteSkills,
      serverLookupStatus: "ok",
      serverLookupMessage: null
    })

    expect(snapshot.checkedAt).toBe("2026-05-02T01:00:00.000Z")
    expect(snapshot.serverLookupStatus).toBe("ok")
    expect(snapshot.rows).toHaveLength(2)

    const existingRow = snapshot.rows.find((row) => row.name === "server-skill")
    expect(existingRow).toMatchObject({
      packageRootPath: existingPath,
      localVersion: "1.0.0",
      sourceAgents: ["codex", "cline"],
      sourceDisplayNames: ["Codex", "Cline"],
      validationState: "valid",
      serverState: "existing",
      remoteSkillId: "remote-server-skill",
      remoteVersion: "2.0.0",
      uploadable: false
    })

    const missingRow = snapshot.rows.find((row) => row.name === "local-only")
    expect(missingRow).toMatchObject({
      packageRootPath: missingPath,
      localVersion: "0.1.0",
      validationState: "valid",
      serverState: "missing",
      remoteSkillId: null,
      remoteVersion: null,
      uploadable: true
    })
  })

  it("uses a valid slug as the server identity when the SKILL name is a display title", async () => {
    const targetPath = createTempRoot()
    const skillPath = writeSkill(
      targetPath,
      "self-improving",
      "name: Self-Improving Agent (With Self-Reflection)\nslug: self-improving\nversion: 1.1.3\ndescription: Agents that improve their own prompts and workflows."
    )
    const remoteSkills: RemoteSkillSummary[] = [
      {
        id: "remote-self-improving",
        name: "self-improving",
        version: "1.1.3",
        contentHash: "hash-self-improving",
        updatedAt: "2026-05-07T00:00:00.000Z"
      }
    ]

    const snapshot = await createLocalSkillInventoryService({
      computeContentHash: async () => "hash-self-improving"
    }).refresh({
      detectionSnapshot: createDetectionSnapshot(targetPath),
      remoteSkills,
      serverLookupStatus: "ok",
      serverLookupMessage: null
    })

    expect(snapshot.rows).toHaveLength(1)
    expect(snapshot.rows[0]).toMatchObject({
      name: "self-improving",
      description: "Agents that improve their own prompts and workflows.",
      packageRootPath: skillPath,
      localVersion: "1.1.3",
      validationState: "valid",
      serverState: "existing",
      remoteSkillId: "remote-self-improving",
      uploadable: false
    })
  })

  it("scans categorized skill roots without treating category folders as invalid skills", async () => {
    const targetPath = createTempRoot()
    const categorizedSkillPath = writeSkill(
      join(targetPath, "tools"),
      "hermes-tool",
      "name: hermes-tool\nversion: 0.4.0"
    )
    mkdirSync(join(targetPath, "empty-category"), { recursive: true })

    const snapshot = await createLocalSkillInventoryService().refresh({
      detectionSnapshot: createCategorizedDetectionSnapshot(targetPath),
      remoteSkills: [],
      serverLookupStatus: "ok",
      serverLookupMessage: null
    })

    expect(snapshot.rows).toHaveLength(1)
    expect(snapshot.rows[0]).toMatchObject({
      name: "hermes-tool",
      packageRootPath: categorizedSkillPath,
      localVersion: "0.4.0",
      validationState: "valid",
      sourceAgents: ["hermes"],
      sourceDisplayNames: ["Hermes Agent"]
    })
  })

  it("parses a multi-line literal block scalar description", async () => {
    const targetPath = createTempRoot()
    const skillPath = writeSkill(
      targetPath,
      "brand-guidelines",
      `name: brand-guidelines
description: |
  Apply Anthropic's official brand colors and typography to artifacts.
  A reference for shaping your own.`
    )

    const snapshot = await createLocalSkillInventoryService().refresh({
      detectionSnapshot: createDetectionSnapshot(targetPath),
      remoteSkills: [],
      serverLookupStatus: "ok",
      serverLookupMessage: null
    })

    expect(snapshot.rows).toHaveLength(1)
    expect(snapshot.rows[0]).toMatchObject({
      name: "brand-guidelines",
      description:
        "Apply Anthropic's official brand colors and typography to artifacts.\nA reference for shaping your own.",
      validationState: "valid"
    })
  })

  it("surfaces the description even when the frontmatter name is invalid", async () => {
    const targetPath = createTempRoot()
    const skillPath = writeSkill(
      targetPath,
      "banner-design",
      "name: ckm:banner-design\ndescription: Design banners across formats."
    )

    const snapshot = await createLocalSkillInventoryService().refresh({
      detectionSnapshot: createDetectionSnapshot(targetPath),
      remoteSkills: [],
      serverLookupStatus: "ok",
      serverLookupMessage: null
    })

    expect(snapshot.rows).toHaveLength(1)
    expect(snapshot.rows[0]).toMatchObject({
      name: null,
      description: "Design banners across formats.",
      packageRootPath: skillPath,
      validationState: "invalid-skill-name",
      serverState: "invalid-local",
      uploadable: false
    })
  })

  it("marks local directories without root SKILL.md as invalid and not uploadable", async () => {
    const targetPath = createTempRoot()
    const invalidPath = join(targetPath, "notes")
    mkdirSync(invalidPath)
    writeFileSync(join(invalidPath, "README.md"), "not a skill")

    const snapshot = await createLocalSkillInventoryService().refresh({
      detectionSnapshot: createDetectionSnapshot(targetPath),
      remoteSkills: [],
      serverLookupStatus: "ok",
      serverLookupMessage: null
    })

    expect(snapshot.rows).toHaveLength(1)
    expect(snapshot.rows[0]).toMatchObject({
      name: null,
      packageRootPath: invalidPath,
      validationState: "missing-skill-md",
      serverState: "invalid-local",
      uploadable: false
    })
  })

  it("does not expose upload when the server lookup is unavailable", async () => {
    const targetPath = createTempRoot()
    writeSkill(targetPath, "local-dir", "name: local-only\nversion: 0.1.0")

    const snapshot = await createLocalSkillInventoryService().refresh({
      detectionSnapshot: createDetectionSnapshot(targetPath),
      remoteSkills: [],
      serverLookupStatus: "auth-failed",
      serverLookupMessage: "401 Unauthorized"
    })

    expect(snapshot.serverLookupStatus).toBe("auth-failed")
    expect(snapshot.serverLookupMessage).toBe("401 Unauthorized")
    expect(snapshot.rows[0]).toMatchObject({
      name: "local-only",
      validationState: "valid",
      serverState: "unknown",
      uploadable: false
    })
  })

  describe("content-hash fallback", () => {
    function createRemoteSkill(overrides: Partial<RemoteSkillSummary> = {}): RemoteSkillSummary {
      return {
        id: "remote-hash-skill",
        name: "hash-skill",
        version: "1.0.0",
        contentHash: "remote-hash",
        updatedAt: "2026-08-26T00:00:00.000Z",
        ...overrides
      }
    }

    it("marks update-available when local content hash differs and version is missing", async () => {
      const targetPath = createTempRoot()
      writeSkill(targetPath, "hash-skill", "name: hash-skill")

      const snapshot = await createLocalSkillInventoryService({
        computeContentHash: async () => "local-hash-different"
      }).refresh({
        detectionSnapshot: createDetectionSnapshot(targetPath),
        remoteSkills: [createRemoteSkill()],
        serverLookupStatus: "ok",
        serverLookupMessage: null
      })

      expect(snapshot.rows[0]).toMatchObject({
        serverState: "update-available",
        uploadable: true
      })
    })

    it("marks update-available when versions are equal but content hash differs", async () => {
      const targetPath = createTempRoot()
      writeSkill(targetPath, "hash-skill", "name: hash-skill\nversion: 1.0.0")

      const snapshot = await createLocalSkillInventoryService({
        computeContentHash: async () => "local-hash-different"
      }).refresh({
        detectionSnapshot: createDetectionSnapshot(targetPath),
        remoteSkills: [createRemoteSkill()],
        serverLookupStatus: "ok",
        serverLookupMessage: null
      })

      expect(snapshot.rows[0]).toMatchObject({
        serverState: "update-available",
        uploadable: true
      })
    })

    it("keeps existing when the local content hash matches the server", async () => {
      const targetPath = createTempRoot()
      writeSkill(targetPath, "hash-skill", "name: hash-skill")

      const snapshot = await createLocalSkillInventoryService({
        computeContentHash: async () => "remote-hash"
      }).refresh({
        detectionSnapshot: createDetectionSnapshot(targetPath),
        remoteSkills: [createRemoteSkill()],
        serverLookupStatus: "ok",
        serverLookupMessage: null
      })

      expect(snapshot.rows[0]).toMatchObject({
        serverState: "existing",
        uploadable: false
      })
    })

    it("keeps existing when the local version is older even if the hash differs", async () => {
      const targetPath = createTempRoot()
      writeSkill(targetPath, "hash-skill", "name: hash-skill\nversion: 0.9.0")

      const snapshot = await createLocalSkillInventoryService({
        computeContentHash: async () => "local-hash-different"
      }).refresh({
        detectionSnapshot: createDetectionSnapshot(targetPath),
        remoteSkills: [createRemoteSkill()],
        serverLookupStatus: "ok",
        serverLookupMessage: null
      })

      expect(snapshot.rows[0]).toMatchObject({
        serverState: "existing",
        uploadable: false
      })
    })

    it("keeps existing when the remote content hash is null", async () => {
      const targetPath = createTempRoot()
      writeSkill(targetPath, "hash-skill", "name: hash-skill")

      let hashCalls = 0
      const snapshot = await createLocalSkillInventoryService({
        computeContentHash: async () => {
          hashCalls += 1
          return "local-hash-different"
        }
      }).refresh({
        detectionSnapshot: createDetectionSnapshot(targetPath),
        remoteSkills: [createRemoteSkill({ contentHash: null })],
        serverLookupStatus: "ok",
        serverLookupMessage: null
      })

      expect(snapshot.rows[0]).toMatchObject({
        serverState: "existing",
        uploadable: false
      })
      expect(hashCalls).toBe(0)
    })

    it("falls back to existing when hash computation fails", async () => {
      const targetPath = createTempRoot()
      writeSkill(targetPath, "hash-skill", "name: hash-skill")

      const snapshot = await createLocalSkillInventoryService({
        computeContentHash: async () => {
          throw new Error("EACCES")
        }
      }).refresh({
        detectionSnapshot: createDetectionSnapshot(targetPath),
        remoteSkills: [createRemoteSkill()],
        serverLookupStatus: "ok",
        serverLookupMessage: null
      })

      expect(snapshot.rows[0]).toMatchObject({
        serverState: "existing",
        uploadable: false
      })
    })

    it("does not compute the hash when the semver comparison already decides", async () => {
      const targetPath = createTempRoot()
      writeSkill(targetPath, "hash-skill", "name: hash-skill\nversion: 2.0.0")

      let hashCalls = 0
      const snapshot = await createLocalSkillInventoryService({
        computeContentHash: async () => {
          hashCalls += 1
          return "irrelevant"
        }
      }).refresh({
        detectionSnapshot: createDetectionSnapshot(targetPath),
        remoteSkills: [createRemoteSkill()],
        serverLookupStatus: "ok",
        serverLookupMessage: null
      })

      expect(snapshot.rows[0]).toMatchObject({
        serverState: "update-available",
        uploadable: true
      })
      expect(hashCalls).toBe(0)
    })
  })
})
