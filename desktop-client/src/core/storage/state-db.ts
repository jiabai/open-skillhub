import { createRequire } from "node:module"
import { dirname } from "node:path"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import initSqlJs from "sql.js"
import type { Database } from "sql.js"

import type {
  DesktopSyncState,
  LocalDistributedSkillRecord,
  PendingSyncUpdate,
  StateStore
} from "@/types"

const require = createRequire(import.meta.url)
const sqlJsWasmPath = require.resolve("sql.js/dist/sql-wasm.wasm")

let sqlModulePromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null

async function getSqlModule(): Promise<Awaited<ReturnType<typeof initSqlJs>>> {
  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs({
      locateFile: () => sqlJsWasmPath
    })
  }

  return sqlModulePromise
}

function ensureDirectory(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
}

function toDatabaseBytes(database: Database): Uint8Array {
  return database.export()
}

function persistDatabase(dbPath: string, database: Database): void {
  ensureDirectory(dbPath)
  writeFileSync(dbPath, toDatabaseBytes(database))
}

function runInTransaction(database: Database, callback: () => void): void {
  database.exec("BEGIN")

  try {
    callback()
    database.exec("COMMIT")
  } catch (error) {
    database.exec("ROLLBACK")
    throw error
  }
}

function readLocalRecords(database: Database): LocalDistributedSkillRecord[] {
  const statement = database.prepare(
    [
      "SELECT remote_skill_id, name, installed_version, remote_version, last_compared_at",
      "FROM distributed_skills",
      "ORDER BY name ASC, remote_skill_id ASC"
    ].join(" ")
  )
  const records: LocalDistributedSkillRecord[] = []

  try {
    while (statement.step()) {
      const row = statement.getAsObject()
      records.push({
        remoteSkillId: String(row.remote_skill_id),
        name: String(row.name),
        installedVersion:
          typeof row.installed_version === "string" && row.installed_version.length > 0
            ? row.installed_version
            : null,
        remoteVersion:
          typeof row.remote_version === "string" && row.remote_version.length > 0
            ? row.remote_version
            : null,
        lastComparedAt:
          typeof row.last_compared_at === "string" && row.last_compared_at.length > 0
            ? row.last_compared_at
            : null
      })
    }
  } finally {
    statement.free()
  }

  return records
}

function readPendingUpdates(database: Database): PendingSyncUpdate[] {
  const statement = database.prepare(
    [
      "SELECT remote_skill_id, name, local_version, remote_version, reason",
      "FROM pending_updates",
      "ORDER BY name ASC, remote_skill_id ASC"
    ].join(" ")
  )
  const updates: PendingSyncUpdate[] = []

  try {
    while (statement.step()) {
      const row = statement.getAsObject()
      updates.push({
        remoteSkillId: String(row.remote_skill_id),
        name: String(row.name),
        localVersion:
          typeof row.local_version === "string" && row.local_version.length > 0
            ? row.local_version
            : null,
        remoteVersion: String(row.remote_version),
        reason:
          row.reason === "version-mismatch" ? "version-mismatch" : "missing-local-record"
      })
    }
  } finally {
    statement.free()
  }

  return updates
}

function writeLocalRecords(database: Database, records: LocalDistributedSkillRecord[]): void {
  const statement = database.prepare(
    [
      "INSERT INTO distributed_skills (remote_skill_id, name, installed_version, remote_version, last_compared_at)",
      "VALUES (?, ?, ?, ?, ?)",
      "ON CONFLICT(remote_skill_id) DO UPDATE SET",
      "name = excluded.name,",
      "installed_version = excluded.installed_version,",
      "remote_version = excluded.remote_version,",
      "last_compared_at = excluded.last_compared_at"
    ].join(" ")
  )

  try {
    database.exec("DELETE FROM distributed_skills")

    for (const record of records) {
      statement.run([
        record.remoteSkillId,
        record.name,
        record.installedVersion,
        record.remoteVersion,
        record.lastComparedAt
      ])
    }
  } finally {
    statement.free()
  }
}

function writePendingUpdates(database: Database, updates: PendingSyncUpdate[]): void {
  const statement = database.prepare(
    [
      "INSERT INTO pending_updates (remote_skill_id, name, local_version, remote_version, reason)",
      "VALUES (?, ?, ?, ?, ?)",
      "ON CONFLICT(remote_skill_id) DO UPDATE SET",
      "name = excluded.name,",
      "local_version = excluded.local_version,",
      "remote_version = excluded.remote_version,",
      "reason = excluded.reason"
    ].join(" ")
  )

  try {
    database.exec("DELETE FROM pending_updates")

    for (const update of updates) {
      statement.run([
        update.remoteSkillId,
        update.name,
        update.localVersion,
        update.remoteVersion,
        update.reason
      ])
    }
  } finally {
    statement.free()
  }
}

function readLastRefreshedAt(database: Database): string | null {
  const statement = database.prepare(
    "SELECT value FROM sync_metadata WHERE key = 'lastRefreshedAt' LIMIT 1"
  )

  try {
    if (!statement.step()) {
      return null
    }

    const row = statement.getAsObject()
    return typeof row.value === "string" && row.value.length > 0 ? row.value : null
  } finally {
    statement.free()
  }
}

function writeLastRefreshedAt(database: Database, lastRefreshedAt: string | null): void {
  if (lastRefreshedAt === null) {
    database.exec("DELETE FROM sync_metadata WHERE key = 'lastRefreshedAt'")
    return
  }

  const statement = database.prepare(
    [
      "INSERT INTO sync_metadata (key, value)",
      "VALUES ('lastRefreshedAt', ?)",
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ].join(" ")
  )

  try {
    statement.run([lastRefreshedAt])
  } finally {
    statement.free()
  }
}

function createSchema(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS distributed_skills (
      remote_skill_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      installed_version TEXT,
      remote_version TEXT,
      last_compared_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pending_updates (
      remote_skill_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      local_version TEXT,
      remote_version TEXT NOT NULL,
      reason TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

export async function createSqliteStateStore(dbPath: string): Promise<StateStore> {
  const SQL = await getSqlModule()
  ensureDirectory(dbPath)

  const existingBytes = (() => {
    try {
      return readFileSync(dbPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null
      }

      throw error
    }
  })()

  const database = existingBytes ? new SQL.Database(existingBytes) : new SQL.Database()

  createSchema(database)

  return {
    async readState(): Promise<DesktopSyncState> {
      return {
        localRecords: readLocalRecords(database),
        pendingUpdates: readPendingUpdates(database),
        lastRefreshedAt: readLastRefreshedAt(database)
      }
    },
    async writeState(state: DesktopSyncState): Promise<void> {
      runInTransaction(database, () => {
        writeLocalRecords(database, state.localRecords)
        writePendingUpdates(database, state.pendingUpdates)
        writeLastRefreshedAt(database, state.lastRefreshedAt)
      })
      persistDatabase(dbPath, database)
    },
    async close(): Promise<void> {
      persistDatabase(dbPath, database)
      database.close()
    }
  }
}
