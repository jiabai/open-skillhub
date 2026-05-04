import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const APP_NAME = "SkillDrive"

export interface AppPaths {
  rootDir: string
  configDir: string
  stateDir: string
  configFilePath: string
  agentPathsFilePath: string
  stateFilePath: string
  stateDbPath: string
}

export interface AppPathsOptions {
  baseDir?: string
}

function getPlatformBaseDir(): string {
  if (process.env.SKILLDRIVE_DESKTOP_DATA_DIR) {
    return process.env.SKILLDRIVE_DESKTOP_DATA_DIR
  }

  if (process.platform === "win32") {
    return join(process.env.LOCALAPPDATA ?? process.env.APPDATA ?? homedir(), APP_NAME)
  }

  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", APP_NAME)
  }

  return join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), APP_NAME)
}

export function createAppPaths(options: AppPathsOptions = {}): AppPaths {
  const rootDir = options.baseDir ?? getPlatformBaseDir()

  return {
    rootDir,
    configDir: join(rootDir, "config"),
    stateDir: join(rootDir, "state"),
    configFilePath: join(rootDir, "config", "config.json"),
    agentPathsFilePath: join(rootDir, "config", "agent-paths.json"),
    stateFilePath: join(rootDir, "state", "state.json"),
    stateDbPath: join(rootDir, "state", "state.sqlite3")
  }
}

export function ensureAppDirectories(options: AppPathsOptions = {}): AppPaths {
  const paths = createAppPaths(options)

  mkdirSync(paths.configDir, { recursive: true })
  mkdirSync(paths.stateDir, { recursive: true })

  return paths
}
