import { compareRemoteSkills } from "@/core/sync/compare"
import type { LocalDistributedSkillRecord, RemoteSkillSummary } from "@/types"

describe("compareRemoteSkills", () => {
  it("marks missing and changed remote skills as pending updates", () => {
    const remoteSkills: RemoteSkillSummary[] = [
      {
        id: "skill-a",
        name: "Skill A",
        version: "1.0.0",
        updatedAt: "2026-04-17T08:00:00.000Z"
      },
      {
        id: "skill-b",
        name: "Skill B",
        version: "2.0.0",
        updatedAt: "2026-04-17T08:01:00.000Z"
      },
      {
        id: "skill-c",
        name: "Skill C",
        version: "1.0.0",
        updatedAt: "2026-04-17T08:02:00.000Z"
      }
    ]

    const localRecords: LocalDistributedSkillRecord[] = [
      {
        remoteSkillId: "skill-a",
        name: "Skill A",
        installedVersion: "1.0.0",
        remoteVersion: "1.0.0",
        lastComparedAt: "2026-04-16T08:00:00.000Z"
      },
      {
        remoteSkillId: "skill-b",
        name: "Skill B",
        installedVersion: "1.5.0",
        remoteVersion: "1.5.0",
        lastComparedAt: "2026-04-16T08:00:00.000Z"
      },
      {
        remoteSkillId: "local-only",
        name: "Local Only",
        installedVersion: "0.1.0",
        remoteVersion: null,
        lastComparedAt: "2026-04-16T08:00:00.000Z"
      }
    ]

    const result = compareRemoteSkills(remoteSkills, localRecords, "2026-04-17T09:00:00.000Z")

    expect(result.pendingUpdates).toEqual([
      {
        remoteSkillId: "skill-b",
        name: "Skill B",
        localVersion: "1.5.0",
        remoteVersion: "2.0.0",
        reason: "version-mismatch"
      },
      {
        remoteSkillId: "skill-c",
        name: "Skill C",
        localVersion: null,
        remoteVersion: "1.0.0",
        reason: "missing-local-record"
      }
    ])

    expect(result.items).toEqual([
      {
        remoteSkillId: "skill-a",
        name: "Skill A",
        localVersion: "1.0.0",
        remoteVersion: "1.0.0",
        status: "in-sync"
      },
      {
        remoteSkillId: "skill-b",
        name: "Skill B",
        localVersion: "1.5.0",
        remoteVersion: "2.0.0",
        status: "update"
      },
      {
        remoteSkillId: "skill-c",
        name: "Skill C",
        localVersion: null,
        remoteVersion: "1.0.0",
        status: "install"
      }
    ])

    expect(result.localRecords).toEqual([
      {
        remoteSkillId: "skill-a",
        name: "Skill A",
        installedVersion: "1.0.0",
        remoteVersion: "1.0.0",
        lastComparedAt: "2026-04-17T09:00:00.000Z"
      },
      {
        remoteSkillId: "skill-b",
        name: "Skill B",
        installedVersion: "1.5.0",
        remoteVersion: "2.0.0",
        lastComparedAt: "2026-04-17T09:00:00.000Z"
      },
      {
        remoteSkillId: "skill-c",
        name: "Skill C",
        installedVersion: null,
        remoteVersion: "1.0.0",
        lastComparedAt: "2026-04-17T09:00:00.000Z"
      },
      {
        remoteSkillId: "local-only",
        name: "Local Only",
        installedVersion: "0.1.0",
        remoteVersion: null,
        lastComparedAt: "2026-04-16T08:00:00.000Z"
      }
    ])
  })
})
