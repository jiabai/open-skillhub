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
      ", installed_content_hash, remote_content_hash",
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
        installedContentHash:
          typeof row.installed_content_hash === "string" && row.installed_content_hash.length > 0
            ? row.installed_content_hash
            : null,
        remoteVersion:
          typeof row.remote_version === "string" && row.remote_version.length > 0
            ? row.remote_version
            : null,
        remoteContentHash:
          typeof row.remote_content_hash === "string" && row.remote_content_hash.length > 0
            ? row.remote_content_hash
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
      ", local_content_hash, remote_content_hash",
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
        localContentHash:
          typeof row.local_content_hash === "string" && row.local_content_hash.length > 0
            ? row.local_content_hash
            : null,
        remoteVersion: String(row.remote_version),
        remoteContentHash:
          typeof row.remote_content_hash === "string" && row.remote_content_hash.length > 0
            ? row.remote_content_hash
            : null,
        reason:
          row.reason === "missing-local-record" || row.reason === "not-installed"
            ? "not-installed"
            : "update"
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
      "INSERT INTO distributed_skills",
      "(remote_skill_id, name, installed_version, remote_version, last_compared_at,",
      "installed_content_hash, remote_content_hash)",
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
      "ON CONFLICT(remote_skill_id) DO UPDATE SET",
      "name = excluded.name,",
      "installed_version = excluded.installed_version,",
      "remote_version = excluded.remote_version,",
      "last_compared_at = excluded.last_compared_at,",
      "installed_content_hash = excluded.installed_content_hash,",
      "remote_content_hash = excluded.remote_content_hash"
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
        record.lastComparedAt,
        record.installedContentHash ?? null,
        record.remoteContentHash ?? null
      ])
    }
  } finally {
    statement.free()
  }
}

function writePendingUpdates(database: Database, updates: PendingSyncUpdate[]): void {
  const statement = database.prepare(
    [
      "INSERT INTO pending_updates",
      "(remote_skill_id, name, local_version, remote_version, reason,",
      "local_content_hash, remote_content_hash)",
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
      "ON CONFLICT(remote_skill_id) DO UPDATE SET",
      "name = excluded.name,",
      "local_version = excluded.local_version,",
      "remote_version = excluded.remote_version,",
      "reason = excluded.reason,",
      "local_content_hash = excluded.local_content_hash,",
      "remote_content_hash = excluded.remote_content_hash"
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
        update.reason,
        update.localContentHash ?? null,
        update.remoteContentHash ?? null
      ])
    }
  } finally {
    statement.free()
  }
}

function readSuccessfulDistributionCount(database: Database): number {
  const statement = database.prepare(
    "SELECT value FROM sync_metadata WHERE key = 'successfulDistributionCount' LIMIT 1"
  )

  try {
    if (!statement.step()) {
      return 0
    }

    const row = statement.getAsObject()
    const parsedCount = Number.parseInt(
      typeof row.value === "string" ? row.value : "",
      10
    )

    return Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 0
  } finally {
    statement.free()
  }
}

function writeSuccessfulDistributionCount(database: Database, count: number): void {
  const normalizedCount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
  const statement = database.prepare(
    [
      "INSERT INTO sync_metadata (key, value)",
      "VALUES ('successfulDistributionCount', ?)",
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ].join(" ")
  )

  try {
    statement.run([String(normalizedCount)])
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
      installed_content_hash TEXT,
      remote_content_hash TEXT,
      last_compared_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pending_updates (
      remote_skill_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      local_version TEXT,
      remote_version TEXT NOT NULL,
      local_content_hash TEXT,
      remote_content_hash TEXT,
      reason TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

function readColumnNames(database: Database, tableName: string): Set<string> {
  const result = database.exec(`PRAGMA table_info(${tableName})`)
  const values = result[0]?.values ?? []

  return new Set(values.map((row) => String(row[1])))
}

function ensureColumn(database: Database, tableName: string, columnName: string, definition: string): void {
  if (readColumnNames(database, tableName).has(columnName)) {
    return
  }

  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
}

function migrateSchema(database: Database): void {
  ensureColumn(database, "distributed_skills", "installed_content_hash", "TEXT")
  ensureColumn(database, "distributed_skills", "remote_content_hash", "TEXT")
  ensureColumn(database, "pending_updates", "local_content_hash", "TEXT")
  ensureColumn(database, "pending_updates", "remote_content_hash", "TEXT")
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
  migrateSchema(database)

  return {
    async readState(): Promise<DesktopSyncState> {
      return {
        localRecords: readLocalRecords(database),
        pendingUpdates: readPendingUpdates(database),
        successfulDistributionCount: readSuccessfulDistributionCount(database),
        lastRefreshedAt: readLastRefreshedAt(database)
      }
    },
    async writeState(state: DesktopSyncState): Promise<void> {
      runInTransaction(database, () => {
        writeLocalRecords(database, state.localRecords)
        writePendingUpdates(database, state.pendingUpdates)
        writeSuccessfulDistributionCount(database, state.successfulDistributionCount)
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
