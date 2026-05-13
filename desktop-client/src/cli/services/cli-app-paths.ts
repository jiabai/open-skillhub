import { join } from "node:path"

export interface CliAppPaths {
  configDir: string
  configPath: string
  agentPathsPath: string
  stateDir: string
  statePath: string
  cacheDir: string
}

export interface CliAppPathOptions {
  env?: Pick<NodeJS.ProcessEnv, "XDG_CONFIG_HOME" | "XDG_STATE_HOME" | "XDG_CACHE_HOME">
  homeDir?: string
}

function trimPath(value: string | undefined): string | null {
  const trimmed = value?.trim()

  return trimmed ? trimmed : null
}

export function resolveCliAppPaths(options: CliAppPathOptions = {}): CliAppPaths {
  const env = options.env ?? process.env
  const homeDir = trimPath(options.homeDir) ?? trimPath(process.env.HOME) ?? trimPath(process.env.USERPROFILE)

  if (!homeDir) {
    throw new Error("Cannot resolve SkillDrive CLI paths without a home directory")
  }

  const configBase = trimPath(env.XDG_CONFIG_HOME) ?? join(homeDir, ".config")
  const stateBase = trimPath(env.XDG_STATE_HOME) ?? join(homeDir, ".local", "state")
  const cacheBase = trimPath(env.XDG_CACHE_HOME) ?? join(homeDir, ".cache")
  const configDir = join(configBase, "skilldrive-cli")
  const stateDir = join(stateBase, "skilldrive-cli")
  const cacheDir = join(cacheBase, "skilldrive-cli")

  return {
    configDir,
    configPath: join(configDir, "config.json"),
    agentPathsPath: join(configDir, "agent-paths.json"),
    stateDir,
    statePath: join(stateDir, "state.sqlite3"),
    cacheDir
  }
}
