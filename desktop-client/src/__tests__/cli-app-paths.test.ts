import { mkdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  createCliConfigStore,
  resolveCliApiBaseUrl,
  resolveCliApiToken
} from "@/cli/services/cli-config-store"
import { resolveCliAppPaths } from "@/cli/services/cli-app-paths"

describe("CLI app paths and non-secret config", () => {
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
    const root = join(tmpdir(), `skilldrive-cli-paths-${Math.random().toString(16).slice(2)}`)
    mkdirSync(root, { recursive: true })
    tempRoots.push(root)
    return root
  }

  it("uses Linux XDG directories when provided", () => {
    const root = createTempRoot()
    const paths = resolveCliAppPaths({
      env: {
        XDG_CONFIG_HOME: join(root, "config"),
        XDG_STATE_HOME: join(root, "state"),
        XDG_CACHE_HOME: join(root, "cache")
      },
      homeDir: join(root, "home")
    })

    expect(paths.configDir).toBe(join(root, "config", "skilldrive-cli"))
    expect(paths.configPath).toBe(join(root, "config", "skilldrive-cli", "config.json"))
    expect(paths.agentPathsPath).toBe(join(root, "config", "skilldrive-cli", "agent-paths.json"))
    expect(paths.statePath).toBe(join(root, "state", "skilldrive-cli", "state.sqlite3"))
    expect(paths.cacheDir).toBe(join(root, "cache", "skilldrive-cli"))
  })

  it("falls back to home-local Linux directories", () => {
    const root = createTempRoot()
    const paths = resolveCliAppPaths({
      env: {},
      homeDir: join(root, "home")
    })

    expect(paths.configDir).toBe(join(root, "home", ".config", "skilldrive-cli"))
    expect(paths.stateDir).toBe(join(root, "home", ".local", "state", "skilldrive-cli"))
    expect(paths.cacheDir).toBe(join(root, "home", ".cache", "skilldrive-cli"))
  })

  it("persists only non-secret config values", async () => {
    const root = createTempRoot()
    const configPath = join(root, "config.json")
    const store = createCliConfigStore(configPath)

    await store.write({ apiBaseUrl: "https://skilldrive.example" })

    expect(await store.read()).toEqual({ apiBaseUrl: "https://skilldrive.example" })
    expect(readFileSync(configPath, "utf8")).not.toContain("token")
  })

  it("resolves API base URL and token with explicit precedence", async () => {
    expect(
      resolveCliApiBaseUrl({
        cliValue: "https://from-cli.example",
        env: { SKILLDRIVE_API_BASE_URL: "https://from-env.example" },
        config: { apiBaseUrl: "https://from-config.example" }
      })
    ).toBe("https://from-cli.example")

    expect(
      resolveCliApiBaseUrl({
        env: { SKILLDRIVE_API_BASE_URL: "https://from-env.example" },
        config: { apiBaseUrl: "https://from-config.example" }
      })
    ).toBe("https://from-env.example")

    expect(resolveCliApiBaseUrl({ env: {}, config: { apiBaseUrl: "https://from-config.example" } })).toBe(
      "https://from-config.example"
    )
    expect(resolveCliApiBaseUrl({ env: {}, config: {} })).toBe("http://127.0.0.1:8001")

    expect(
      resolveCliApiToken({
        cliValue: "cli-token",
        env: { SKILLDRIVE_API_TOKEN: "env-token" }
      })
    ).toBe("cli-token")
    expect(resolveCliApiToken({ env: { SKILLDRIVE_API_TOKEN: "env-token" } })).toBe("env-token")
    expect(resolveCliApiToken({ env: {} })).toBeNull()
  })
})
