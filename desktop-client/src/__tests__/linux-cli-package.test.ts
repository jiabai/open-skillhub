import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"

type LinuxCliPackageModule = {
  CLI_RUNTIME_DEPENDENCIES: string[]
  createBinWrapper(): string
  createLinuxCliManifest(input: {
    version: string
    gitCommit: string | null
    createdAt: string
  }): {
    name: string
    version: string
    minimumNodeMajor: number
    runtimeDependencies: string[]
  }
  resolveRuntimeDependencyPackageKeys(
    packageLock: unknown,
    dependencyNames: string[]
  ): string[]
  assertNoForbiddenPackageContents(root: string): Promise<void>
  createCommandSpec(command: string, args: string[], platform: NodeJS.Platform): {
    command: string
    args: string[]
    shell: boolean
  }
}

async function importPackageModule(): Promise<LinuxCliPackageModule> {
  const moduleUrl = pathToFileURL(
    join(process.cwd(), "scripts", "package-linux-cli.mjs")
  ).href

  return await import(moduleUrl) as LinuxCliPackageModule
}

describe("Linux CLI package assembly", () => {
  it("declares the runtime dependency closure needed by the current CLI bundle", async () => {
    const packageModule = await importPackageModule()
    const packageLock = JSON.parse(readFileSync(join(process.cwd(), "package-lock.json"), "utf8"))
    const packageKeys = packageModule.resolveRuntimeDependencyPackageKeys(
      packageLock,
      packageModule.CLI_RUNTIME_DEPENDENCIES
    )

    expect(packageModule.CLI_RUNTIME_DEPENDENCIES).toEqual([
      "commander",
      "extract-zip",
      "sql.js"
    ])
    expect(packageKeys).toContain("node_modules/commander")
    expect(packageKeys).toContain("node_modules/extract-zip")
    expect(packageKeys).toContain("node_modules/yauzl")
    expect(packageKeys).toContain("node_modules/sql.js")
    expect(packageKeys).not.toContain("node_modules/@types/yauzl")
    expect(packageKeys).not.toContain("node_modules/@types/node")
    expect(packageKeys).not.toContain("node_modules/electron")
    expect(packageKeys).not.toContain("node_modules/react")
  })

  it("creates release metadata and a wrapper that runs the bundled CLI entry", async () => {
    const packageModule = await importPackageModule()
    const manifest = packageModule.createLinuxCliManifest({
      version: "0.1.4",
      gitCommit: "abc123",
      createdAt: "2026-05-14T00:00:00.000Z"
    })
    const wrapper = packageModule.createBinWrapper()

    expect(manifest).toMatchObject({
      name: "skilldrive-cli",
      version: "0.1.4",
      minimumNodeMajor: 20,
      runtimeDependencies: ["commander", "extract-zip", "sql.js"]
    })
    expect(wrapper).toContain("#!/usr/bin/env sh")
    expect(wrapper).toContain('exec node "$SCRIPT_DIR/../lib/skilldrive-cli.js" "$@"')
  })

  it("rejects forbidden desktop/runtime packages in the release staging directory", async () => {
    const packageModule = await importPackageModule()
    const root = await mkdtemp(join(tmpdir(), "skilldrive-linux-cli-package-"))

    try {
      await mkdir(join(root, "node_modules", "electron"), { recursive: true })
      await writeFile(join(root, "node_modules", "electron", "package.json"), "{}")

      await expect(packageModule.assertNoForbiddenPackageContents(root)).rejects.toThrow(
        /Forbidden Linux CLI package content/
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("runs npm through cmd.exe on Windows so package assembly can build the CLI", async () => {
    const packageModule = await importPackageModule()

    expect(packageModule.createCommandSpec("npm", ["run", "build:cli"], "win32")).toEqual({
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "npm run build:cli"],
      shell: false
    })
    expect(packageModule.createCommandSpec("git", ["rev-parse", "HEAD"], "win32")).toEqual({
      command: "git",
      args: ["rev-parse", "HEAD"],
      shell: false
    })
  })
})
