import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { dirname } from "node:path"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

import initSqlJs from "sql.js"
import type { Database } from "sql.js"

import type { AgentId } from "@/types"

const require = createRequire(import.meta.url)
const sqlJsWasmPath = require.resolve("sql.js/dist/sql-wasm.wasm")

export type CliSyncScopeType = "global" | "project"

export interface CliSyncScope {
  scopeType: CliSyncScopeType
  scopeKey: string
}

export interface CliDistributedSkillRecord extends CliSyncScope {
  targetKey: string
  agentId: AgentId
  remoteSkillId: string
  name: string
  installedVersion: string | null
  installedContentHash: string | null
  remoteVersion: string | null
  remoteContentHash: string | null
  lastSyncedAt: string | null
}

export interface CliSyncRecordKeyInput {
  scopeType: CliSyncScopeType
  scopeKey: string
  targetKey: string
  remoteSkillId: string
}

export interface CliSyncStateStore {
  listRecords(scope: CliSyncScope): Promise<CliDistributedSkillRecord[]>
  findRecord(input: CliSyncRecordKeyInput): Promise<CliDistributedSkillRecord | null>
  upsertRecord(record: CliDistributedSkillRecord): Promise<void>
  close(): Promise<void>
}

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

function persistDatabase(dbPath: string, database: Database): void {
  ensureDirectory(dbPath)
  writeFileSync(dbPath, database.export())
}

function normalizePart(value: string, label: string): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error(`CLI sync ${label} cannot be empty`)
  }

  return normalized
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function toRecord(row: Record<string, unknown>): CliDistributedSkillRecord {
  return {
    scopeType: row.scope_type === "project" ? "project" : "global",
    scopeKey: String(row.scope_key),
    targetKey: String(row.target_key),
    agentId: String(row.agent_id) as AgentId,
    remoteSkillId: String(row.remote_skill_id),
    name: String(row.name),
    installedVersion: nullableString(row.installed_version),
    installedContentHash: nullableString(row.installed_content_hash),
    remoteVersion: nullableString(row.remote_version),
    remoteContentHash: nullableString(row.remote_content_hash),
    lastSyncedAt: nullableString(row.last_synced_at)
  }
}

function createSchema(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS cli_distributed_skills (
      record_key TEXT PRIMARY KEY,
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      target_key TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      remote_skill_id TEXT NOT NULL,
      name TEXT NOT NULL,
      installed_version TEXT,
      installed_content_hash TEXT,
      remote_version TEXT,
      remote_content_hash TEXT,
      last_synced_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS cli_distributed_scope_skill_idx
    ON cli_distributed_skills(scope_type, scope_key, target_key, remote_skill_id);
  `)
}

export function createCliSyncRecordKey(input: CliSyncRecordKeyInput): string {
  return createHash("sha256")
    .update(
      [
        normalizePart(input.scopeType, "scopeType"),
        normalizePart(input.scopeKey, "scopeKey"),
        normalizePart(input.targetKey, "targetKey"),
        normalizePart(input.remoteSkillId, "remoteSkillId")
      ].join("\0")
    )
    .digest("hex")
}

export async function createCliSyncStateStore(dbPath: string): Promise<CliSyncStateStore> {
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
    async listRecords(scope: CliSyncScope): Promise<CliDistributedSkillRecord[]> {
      const statement = database.prepare(
        [
          "SELECT scope_type, scope_key, target_key, agent_id, remote_skill_id, name,",
          "installed_version, installed_content_hash, remote_version, remote_content_hash, last_synced_at",
          "FROM cli_distributed_skills",
          "WHERE scope_type = ? AND scope_key = ?",
          "ORDER BY name ASC, remote_skill_id ASC, target_key ASC"
        ].join(" ")
      )
      const records: CliDistributedSkillRecord[] = []

      try {
        statement.bind([scope.scopeType, scope.scopeKey])

        while (statement.step()) {
          records.push(toRecord(statement.getAsObject()))
        }
      } finally {
        statement.free()
      }

      return records
    },
    async findRecord(input: CliSyncRecordKeyInput): Promise<CliDistributedSkillRecord | null> {
      const statement = database.prepare(
        [
          "SELECT scope_type, scope_key, target_key, agent_id, remote_skill_id, name,",
          "installed_version, installed_content_hash, remote_version, remote_content_hash, last_synced_at",
          "FROM cli_distributed_skills",
          "WHERE record_key = ?",
          "LIMIT 1"
        ].join(" ")
      )

      try {
        statement.bind([createCliSyncRecordKey(input)])

        if (!statement.step()) {
          return null
        }

        return toRecord(statement.getAsObject())
      } finally {
        statement.free()
      }
    },
    async upsertRecord(record: CliDistributedSkillRecord): Promise<void> {
      const normalizedRecord: CliDistributedSkillRecord = {
        ...record,
        scopeKey: normalizePart(record.scopeKey, "scopeKey"),
        targetKey: normalizePart(record.targetKey, "targetKey"),
        remoteSkillId: normalizePart(record.remoteSkillId, "remoteSkillId"),
        name: normalizePart(record.name, "name")
      }
      const statement = database.prepare(
        [
          "INSERT INTO cli_distributed_skills",
          "(record_key, scope_type, scope_key, target_key, agent_id, remote_skill_id, name,",
          "installed_version, installed_content_hash, remote_version, remote_content_hash, last_synced_at)",
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          "ON CONFLICT(scope_type, scope_key, target_key, remote_skill_id) DO UPDATE SET",
          "record_key = excluded.record_key,",
          "agent_id = excluded.agent_id,",
          "name = excluded.name,",
          "installed_version = excluded.installed_version,",
          "installed_content_hash = excluded.installed_content_hash,",
          "remote_version = excluded.remote_version,",
          "remote_content_hash = excluded.remote_content_hash,",
          "last_synced_at = excluded.last_synced_at"
        ].join(" ")
      )

      try {
        statement.run([
          createCliSyncRecordKey(normalizedRecord),
          normalizedRecord.scopeType,
          normalizedRecord.scopeKey,
          normalizedRecord.targetKey,
          normalizedRecord.agentId,
          normalizedRecord.remoteSkillId,
          normalizedRecord.name,
          normalizedRecord.installedVersion,
          normalizedRecord.installedContentHash,
          normalizedRecord.remoteVersion,
          normalizedRecord.remoteContentHash,
          normalizedRecord.lastSyncedAt
        ])
        persistDatabase(dbPath, database)
      } finally {
        statement.free()
      }
    },
    async close(): Promise<void> {
      persistDatabase(dbPath, database)
      database.close()
    }
  }
}
