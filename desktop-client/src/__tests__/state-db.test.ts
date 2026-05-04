import { createRequire } from "node:module"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import initSqlJs from "sql.js"
import { afterEach, describe, expect, it } from "vitest"

import { createSqliteStateStore } from "@/core/storage/state-db"

const require = createRequire(import.meta.url)
const sqlJsWasmPath = require.resolve("sql.js/dist/sql-wasm.wasm")

describe("state-db", () => {
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
    const root = mkdtempSync(join(tmpdir(), "skilldrive-state-db-"))
    tempRoots.push(root)
    return root
  }

  async function createLegacyStateDb(dbPath: string): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: () => sqlJsWasmPath
    })
    const database = new SQL.Database()

    database.exec(`
      CREATE TABLE distributed_skills (
        remote_skill_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        installed_version TEXT,
        remote_version TEXT,
        last_compared_at TEXT
      );

      CREATE TABLE pending_updates (
        remote_skill_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        local_version TEXT,
        remote_version TEXT NOT NULL,
        reason TEXT NOT NULL
      );

      CREATE TABLE sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      INSERT INTO distributed_skills
        (remote_skill_id, name, installed_version, remote_version, last_compared_at)
      VALUES
        ('skill-a', 'Skill A', '1.0.0', '1.0.1', '2026-04-17T00:00:00.000Z');

      INSERT INTO pending_updates
        (remote_skill_id, name, local_version, remote_version, reason)
      VALUES
        ('skill-b', 'Skill B', '1.0.0', '1.0.1', 'version-mismatch');
    `)

    writeFileSync(dbPath, database.export())
    database.close()
  }

  it("migrates legacy state files to content hash columns", async () => {
    const root = createTempRoot()
    const dbPath = join(root, "state.sqlite3")
    await createLegacyStateDb(dbPath)

    const stateStore = await createSqliteStateStore(dbPath)

    expect(await stateStore.readState()).toMatchObject({
      localRecords: [
        {
          remoteSkillId: "skill-a",
          installedContentHash: null,
          remoteContentHash: null
        }
      ],
      pendingUpdates: [
        {
          remoteSkillId: "skill-b",
          localContentHash: null,
          remoteContentHash: null,
          reason: "update"
        }
      ]
    })

    await stateStore.writeState({
      localRecords: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          installedVersion: "1.0.0",
          installedContentHash: "hash-a",
          remoteVersion: "1.0.1",
          remoteContentHash: "hash-a",
          lastComparedAt: "2026-04-17T01:00:00.000Z"
        }
      ],
      pendingUpdates: [
        {
          remoteSkillId: "skill-b",
          name: "Skill B",
          localVersion: "1.0.0",
          localContentHash: "hash-b-local",
          remoteVersion: "1.0.1",
          remoteContentHash: "hash-b-remote",
          reason: "update"
        }
      ],
      successfulDistributionCount: 0,
      lastRefreshedAt: null
    })

    expect(await stateStore.readState()).toMatchObject({
      localRecords: [
        {
          installedContentHash: "hash-a",
          remoteContentHash: "hash-a"
        }
      ],
      pendingUpdates: [
        {
          localContentHash: "hash-b-local",
          remoteContentHash: "hash-b-remote",
          reason: "update"
        }
      ]
    })

    await stateStore.close()
  })
})
