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
})
