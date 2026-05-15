import { createRequire } from "node:module"
import { isAbsolute } from "node:path"

const require = createRequire(import.meta.url)
const extractZip = require("extract-zip") as typeof import("extract-zip")

const MODE_TYPE_MASK = 0o170000
const MODE_SYMLINK = 0o120000

function isSymlinkEntry(externalFileAttributes: number): boolean {
  const mode = (externalFileAttributes >>> 16) & MODE_TYPE_MASK

  return mode === MODE_SYMLINK
}

function assertSafeZipEntryPath(fileName: string): void {
  const normalized = fileName.replace(/\\/g, "/")
  const withoutTrailingSlash = normalized.endsWith("/")
    ? normalized.slice(0, -1)
    : normalized
  const segments = withoutTrailingSlash.split("/")

  if (
    !withoutTrailingSlash ||
    withoutTrailingSlash.startsWith("/") ||
    /^[a-zA-Z]:/.test(withoutTrailingSlash) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe zip entry path: ${fileName}`)
  }
}

export async function extractZipArchive(archivePath: string, extractedPath: string): Promise<void> {
  if (!isAbsolute(archivePath)) {
    throw new Error(`Archive path must be absolute: ${archivePath}`)
  }

  if (!isAbsolute(extractedPath)) {
    throw new Error(`Extraction directory must be absolute: ${extractedPath}`)
  }

  try {
    await extractZip(archivePath, {
      dir: extractedPath,
      onEntry: (entry) => {
        assertSafeZipEntryPath(entry.fileName)

        if (isSymlinkEntry(entry.externalFileAttributes)) {
          throw new Error(`Symbolic links are not allowed in skill packages: ${entry.fileName}`)
        }
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("invalid relative path")) {
      throw new Error(`Unsafe zip entry path: ${error.message}`)
    }

    throw error
  }
}
