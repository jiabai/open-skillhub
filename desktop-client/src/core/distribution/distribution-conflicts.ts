import { rm, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"

export async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

export function isSameOrInsidePath(pathValue: string, parentPath: string): boolean {
  const normalizedPath = resolve(pathValue)
  const normalizedParent = resolve(parentPath)
  const relativePath = relative(normalizedParent, normalizedPath)

  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))
}

export async function removeSkillDestination(args: {
  destinationPath: string
  targetPath: string
}): Promise<void> {
  if (!isSameOrInsidePath(args.destinationPath, args.targetPath) || resolve(args.destinationPath) === resolve(args.targetPath)) {
    throw new Error(`Refusing to remove destination outside target root: ${args.destinationPath}`)
  }

  await rm(args.destinationPath, { recursive: true, force: true })
}
