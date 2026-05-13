import { mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  createCliSyncRecordKey,
  createCliSyncStateStore
} from "@/cli/services/cli-sync-state"

describe("CLI scoped sync state", () => {
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
    const root = join(tmpdir(), `skilldrive-cli-state-${Math.random().toString(16).slice(2)}`)
    mkdirSync(root, { recursive: true })
    tempRoots.push(root)
    return root
  }

  it("keeps global and project records separate for the same remote skill", async () => {
    const dbPath = join(createTempRoot(), "state.sqlite3")
    const store = await createCliSyncStateStore(dbPath)

    await store.upsertRecord({
      scopeType: "global",
      scopeKey: "global",
      targetKey: "/home/test/.agents/skills",
      agentId: "codex",
      remoteSkillId: "skill-1",
      name: "skill-one",
      installedVersion: "1.0.0",
      installedContentHash: "hash-global",
      remoteVersion: "1.0.0",
      remoteContentHash: "hash-global",
      lastSyncedAt: "2026-05-13T01:00:00.000Z"
    })
    await store.upsertRecord({
      scopeType: "project",
      scopeKey: "/repo/a",
      targetKey: "/repo/a/.agents/skills",
      agentId: "codex",
      remoteSkillId: "skill-1",
      name: "skill-one",
      installedVersion: "1.0.0",
      installedContentHash: "hash-project",
      remoteVersion: "1.0.0",
      remoteContentHash: "hash-project",
      lastSyncedAt: "2026-05-13T02:00:00.000Z"
    })

    expect(await store.listRecords({ scopeType: "global", scopeKey: "global" })).toHaveLength(1)
    expect(await store.listRecords({ scopeType: "project", scopeKey: "/repo/a" })).toHaveLength(1)
    expect((await store.listRecords({ scopeType: "global", scopeKey: "global" }))[0]?.installedContentHash).toBe(
      "hash-global"
    )
    expect((await store.listRecords({ scopeType: "project", scopeKey: "/repo/a" }))[0]?.installedContentHash).toBe(
      "hash-project"
    )

    await store.close()
  })

  it("creates stable record keys with scope and target identity", () => {
    expect(
      createCliSyncRecordKey({
        scopeType: "global",
        scopeKey: "global",
        targetKey: "/home/test/.agents/skills",
        remoteSkillId: "skill-1"
      })
    ).not.toBe(
      createCliSyncRecordKey({
        scopeType: "project",
        scopeKey: "/repo/a",
        targetKey: "/repo/a/.agents/skills",
        remoteSkillId: "skill-1"
      })
    )
  })
})
