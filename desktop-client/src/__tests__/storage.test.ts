import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { APP_NAME, createAppPaths, ensureAppDirectories } from "@/core/storage/app-paths"
import { resolveApiTokenBootstrap } from "@/core/storage/auth-bootstrap"
import { createJsonConfigStore } from "@/core/storage/config-store"
import {
  createKeytarSecretStore,
  createInMemorySecretStore
} from "@/core/storage/secret-store"

describe("storage foundation", () => {
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
    const root = mkdtempSync(join(tmpdir(), "open-skillhub-desktop-"))
    tempRoots.push(root)
    return root
  }

  it("creates the expected app directories", () => {
    const rootDir = createTempRoot()
    const paths = ensureAppDirectories({ baseDir: rootDir })

    expect(paths).toEqual(
      expect.objectContaining({
        rootDir,
        configDir: join(rootDir, "config"),
        stateDir: join(rootDir, "state"),
        configFilePath: join(rootDir, "config", "config.json"),
        stateFilePath: join(rootDir, "state", "state.json")
      })
    )

    expect(statSync(paths.configDir).isDirectory()).toBe(true)
    expect(statSync(paths.stateDir).isDirectory()).toBe(true)
  })

  it("persists non-secret config cleanly", async () => {
    const rootDir = createTempRoot()
    const paths = createAppPaths({ baseDir: rootDir })
    const store = createJsonConfigStore(paths.configFilePath, {
      apiBaseUrl: "http://localhost:8001",
      locale: "en-US",
      launchOnStartup: false
    })

    expect(await store.read()).toEqual({
      apiBaseUrl: "http://localhost:8001",
      locale: "en-US",
      launchOnStartup: false
    })

    await store.update({
      locale: "zh-CN",
      launchOnStartup: true
    })

    expect(await store.read()).toEqual({
      apiBaseUrl: "http://localhost:8001",
      locale: "zh-CN",
      launchOnStartup: true
    })

    expect(JSON.parse(readFileSync(paths.configFilePath, "utf8"))).toEqual({
      apiBaseUrl: "http://localhost:8001",
      locale: "zh-CN",
      launchOnStartup: true
    })
  })

  it("stores API tokens through the keytar-backed secret store boundary", async () => {
    const adapter = {
      getPassword: vi.fn(async () => null),
      setPassword: vi.fn(async () => undefined),
      deletePassword: vi.fn(async () => true)
    }
    const store = createKeytarSecretStore(APP_NAME, adapter)

    expect(await store.getApiToken()).toBeNull()

    await store.setApiToken("  ask_live_123  ")

    expect(adapter.setPassword).toHaveBeenCalledWith(APP_NAME, "api-token", "ask_live_123")
    expect(await store.getApiToken()).toBeNull()

    await store.clearApiToken()

    expect(adapter.deletePassword).toHaveBeenCalledWith(APP_NAME, "api-token")
  })

  it("provides an in-memory secret store for unit tests", async () => {
    const store = createInMemorySecretStore()

    await store.setApiToken("ask_live_test")

    expect(await store.getApiToken()).toBe("ask_live_test")

    await store.clearApiToken()

    expect(await store.getApiToken()).toBeNull()
  })

  it("prefers a token that already exists in the secret store", async () => {
    const store = createInMemorySecretStore("ask_live_stored")
    const result = await resolveApiTokenBootstrap({
      secretStore: store,
      envToken: "ask_live_env"
    })

    expect(result).toEqual({
      apiToken: "ask_live_stored",
      source: "secret-store",
      persistedEnvironmentToken: false,
      secretStoreAvailable: true,
      warning: null
    })
  })

  it("uses the environment token as an explicit first-run secret-store bootstrap", async () => {
    const store = createInMemorySecretStore()
    const result = await resolveApiTokenBootstrap({
      secretStore: store,
      envToken: "  ask_live_env  "
    })

    expect(result).toEqual({
      apiToken: "ask_live_env",
      source: "environment",
      persistedEnvironmentToken: true,
      secretStoreAvailable: true,
      warning: null
    })
    expect(await store.getApiToken()).toBe("ask_live_env")
  })

  it("falls back to the environment token for the current session when secret storage fails", async () => {
    const store = {
      getApiToken: vi.fn(async () => {
        throw new Error("keytar unavailable")
      }),
      setApiToken: vi.fn(async () => undefined),
      clearApiToken: vi.fn(async () => undefined)
    }
    const result = await resolveApiTokenBootstrap({
      secretStore: store,
      envToken: "ask_live_env"
    })

    expect(result).toEqual({
      apiToken: "ask_live_env",
      source: "environment",
      persistedEnvironmentToken: false,
      secretStoreAvailable: false,
      warning: "Secret store unavailable during API token bootstrap: keytar unavailable"
    })
    expect(store.setApiToken).not.toHaveBeenCalled()
  })
})
