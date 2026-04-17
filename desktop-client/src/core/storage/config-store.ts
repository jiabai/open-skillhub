import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

export type JsonRecord = Record<string, unknown>

export interface ConfigStore<T extends JsonRecord> {
  read(): Promise<T>
  write(value: T): Promise<void>
  update(patch: Partial<T>): Promise<T>
  clear(): Promise<void>
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

export function createJsonConfigStore<T extends JsonRecord>(
  filePath: string,
  defaults: T
): ConfigStore<T> {
  async function read(): Promise<T> {
    try {
      const raw = await readFile(filePath, "utf8")
      const parsed = JSON.parse(raw) as unknown

      if (!isRecord(parsed)) {
        return clone(defaults)
      }

      return {
        ...clone(defaults),
        ...parsed
      } as T
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return clone(defaults)
      }

      throw error
    }
  }

  return {
    read,
    async write(value: T): Promise<void> {
      await writeJsonFile(filePath, value)
    },
    async update(patch: Partial<T>): Promise<T> {
      const next = {
        ...(await read()),
        ...patch
      } as T

      await writeJsonFile(filePath, next)
      return next
    },
    async clear(): Promise<void> {
      try {
        await writeJsonFile(filePath, clone(defaults))
      } catch (error) {
        throw error
      }
    }
  }
}
