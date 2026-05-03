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

export async function extractZipArchive(archivePath: string, extractedPath: string): Promise<void> {
  if (!isAbsolute(archivePath)) {
    throw new Error(`Archive path must be absolute: ${archivePath}`)
  }

  if (!isAbsolute(extractedPath)) {
    throw new Error(`Extraction directory must be absolute: ${extractedPath}`)
  }

  await extractZip(archivePath, {
    dir: extractedPath,
    onEntry: (entry) => {
      if (isSymlinkEntry(entry.externalFileAttributes)) {
        throw new Error(`Symbolic links are not allowed in skill packages: ${entry.fileName}`)
      }
    }
  })
}
