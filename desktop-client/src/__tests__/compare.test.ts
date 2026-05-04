import { compareRemoteSkills } from "@/core/sync/compare"
import type { LocalDistributedSkillRecord, RemoteSkillSummary } from "@/types"

describe("compareRemoteSkills", () => {
  it("uses content hashes instead of version strings for sync status", () => {
    const remoteSkills: RemoteSkillSummary[] = [
      {
        id: "skill-a",
        name: "Skill A",
        version: "1.0.1",
        contentHash: "hash-a",
        updatedAt: "2026-04-17T08:00:00.000Z"
      },
      {
        id: "skill-b",
        name: "Skill B",
        version: "2.0.0",
        contentHash: "hash-b-remote",
        updatedAt: "2026-04-17T08:01:00.000Z"
      },
      {
        id: "skill-c",
        name: "Skill C",
        version: "1.0.0",
        contentHash: "hash-c",
        updatedAt: "2026-04-17T08:02:00.000Z"
      },
      {
        id: "skill-d",
        name: "Skill D",
        version: "3.0.0",
        contentHash: null,
        updatedAt: "2026-04-17T08:03:00.000Z"
      }
    ]

    const localRecords: LocalDistributedSkillRecord[] = [
      {
        remoteSkillId: "skill-a",
        name: "Skill A",
        installedVersion: "1.0.0",
        installedContentHash: "hash-a",
        remoteVersion: "1.0.0",
        remoteContentHash: "hash-a",
        lastComparedAt: "2026-04-16T08:00:00.000Z"
      },
      {
        remoteSkillId: "skill-b",
        name: "Skill B",
        installedVersion: "1.5.0",
        installedContentHash: "hash-b-local",
        remoteVersion: "1.5.0",
        remoteContentHash: "hash-b-local",
        lastComparedAt: "2026-04-16T08:00:00.000Z"
      },
      {
        remoteSkillId: "skill-d",
        name: "Skill D",
        installedVersion: "2.9.0",
        installedContentHash: "hash-d-local",
        remoteVersion: "2.9.0",
        remoteContentHash: "hash-d-local",
        lastComparedAt: "2026-04-16T08:00:00.000Z"
      },
      {
        remoteSkillId: "local-only",
        name: "Local Only",
        installedVersion: "0.1.0",
        installedContentHash: "hash-local-only",
        remoteVersion: null,
        remoteContentHash: null,
        lastComparedAt: "2026-04-16T08:00:00.000Z"
      }
    ]

    const result = compareRemoteSkills(remoteSkills, localRecords, "2026-04-17T09:00:00.000Z")

    expect(result.pendingUpdates).toEqual([
      {
        remoteSkillId: "skill-b",
        name: "Skill B",
        localVersion: "1.5.0",
        localContentHash: "hash-b-local",
        remoteVersion: "2.0.0",
        remoteContentHash: "hash-b-remote",
        reason: "update"
      },
      {
        remoteSkillId: "skill-c",
        name: "Skill C",
        localVersion: null,
        localContentHash: null,
        remoteVersion: "1.0.0",
        remoteContentHash: "hash-c",
        reason: "not-installed"
      }
    ])

    expect(result.items).toEqual([
      {
        remoteSkillId: "skill-a",
        name: "Skill A",
        localVersion: "1.0.0",
        localContentHash: "hash-a",
        remoteVersion: "1.0.1",
        remoteContentHash: "hash-a",
        status: "installed"
      },
      {
        remoteSkillId: "skill-b",
        name: "Skill B",
        localVersion: "1.5.0",
        localContentHash: "hash-b-local",
        remoteVersion: "2.0.0",
        remoteContentHash: "hash-b-remote",
        status: "update"
      },
      {
        remoteSkillId: "skill-c",
        name: "Skill C",
        localVersion: null,
        localContentHash: null,
        remoteVersion: "1.0.0",
        remoteContentHash: "hash-c",
        status: "not-installed"
      },
      {
        remoteSkillId: "skill-d",
        name: "Skill D",
        localVersion: "2.9.0",
        localContentHash: "hash-d-local",
        remoteVersion: "3.0.0",
        remoteContentHash: null,
        status: "installed"
      }
    ])

    expect(result.localRecords).toEqual([
      {
        remoteSkillId: "skill-a",
        name: "Skill A",
        installedVersion: "1.0.0",
        installedContentHash: "hash-a",
        remoteVersion: "1.0.1",
        remoteContentHash: "hash-a",
        lastComparedAt: "2026-04-17T09:00:00.000Z"
      },
      {
        remoteSkillId: "skill-b",
        name: "Skill B",
        installedVersion: "1.5.0",
        installedContentHash: "hash-b-local",
        remoteVersion: "2.0.0",
        remoteContentHash: "hash-b-remote",
        lastComparedAt: "2026-04-17T09:00:00.000Z"
      },
      {
        remoteSkillId: "skill-c",
        name: "Skill C",
        installedVersion: null,
        installedContentHash: null,
        remoteVersion: "1.0.0",
        remoteContentHash: "hash-c",
        lastComparedAt: "2026-04-17T09:00:00.000Z"
      },
      {
        remoteSkillId: "skill-d",
        name: "Skill D",
        installedVersion: "2.9.0",
        installedContentHash: "hash-d-local",
        remoteVersion: "3.0.0",
        remoteContentHash: null,
        lastComparedAt: "2026-04-17T09:00:00.000Z"
      },
      {
        remoteSkillId: "local-only",
        name: "Local Only",
        installedVersion: "0.1.0",
        installedContentHash: "hash-local-only",
        remoteVersion: null,
        remoteContentHash: null,
        lastComparedAt: "2026-04-16T08:00:00.000Z"
      }
    ])
  })
})
