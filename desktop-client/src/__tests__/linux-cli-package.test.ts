import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { pathToFileURL } from "node:url"
import { gunzipSync } from "node:zlib"
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
  copyTextFileWithLf(source: string, destination: string): Promise<void>
  createTarGz(input: { sourceRoot: string; outputPath: string }): Promise<void>
}

async function importPackageModule(): Promise<LinuxCliPackageModule> {
  const moduleUrl = pathToFileURL(
    join(process.cwd(), "scripts", "package-linux-cli.mjs")
  ).href

  return await import(moduleUrl) as LinuxCliPackageModule
}

function parseTarModes(content: Buffer): Map<string, number> {
  const modes = new Map<string, number>()
  let offset = 0

  while (offset + 512 <= content.length) {
    const header = content.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) {
      break
    }

    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "")
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "")
    const path = prefix ? `${prefix}/${name}` : name
    const modeText = header.subarray(100, 108).toString("ascii").replace(/\0.*$/, "").trim()
    const sizeText = header.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim()
    const size = Number.parseInt(sizeText || "0", 8)

    modes.set(path, Number.parseInt(modeText, 8))
    offset += 512 + Math.ceil(size / 512) * 512
  }

  return modes
}

describe("Linux CLI package assembly", () => {
  it("keeps Linux-executed shebang files LF-only", () => {
    const linuxEntrypoints = [
      "scripts/linux-cli/install.sh",
      "scripts/linux-cli/uninstall.sh",
      "src/cli/main.ts"
    ]

    for (const entrypoint of linuxEntrypoints) {
      const content = readFileSync(join(process.cwd(), entrypoint), "utf8")
      const firstLine = content.split("\n")[0]

      expect(firstLine, entrypoint).toMatch(/^#!/)
      expect(content, entrypoint).not.toContain("\r")
    }
  })

  it("normalizes copied release shell scripts to LF", async () => {
    const packageModule = await importPackageModule()
    const root = await mkdtemp(join(tmpdir(), "skilldrive-linux-cli-lf-"))
    const sourcePath = join(root, "install.sh")
    const destinationPath = join(root, "copied", "install.sh")

    try {
      await writeFile(sourcePath, "#!/usr/bin/env sh\r\nset -eu\r\n")

      await packageModule.copyTextFileWithLf(sourcePath, destinationPath)

      expect(readFileSync(destinationPath, "utf8")).toBe("#!/usr/bin/env sh\nset -eu\n")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

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
    expect(wrapper).not.toContain("\r")
    expect(wrapper).toContain('while [ -L "$self" ]; do')
    expect(wrapper).toContain('self=$(readlink "$self")')
    expect(wrapper).toContain('SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$self")" && pwd)')
    expect(wrapper).toContain('exec node "$SCRIPT_DIR/../lib/skilldrive-cli.js" "$@"')
  })

  it("writes executable modes for the release command and shell scripts in the tarball", async () => {
    const packageModule = await importPackageModule()
    const root = await mkdtemp(join(tmpdir(), "skilldrive-linux-cli-tar-"))
    const releaseRoot = join(root, "skilldrive-cli-test")
    const artifactPath = join(root, "skilldrive-cli-test.tar.gz")

    try {
      await mkdir(join(releaseRoot, "bin"), { recursive: true })
      await mkdir(join(releaseRoot, "lib"), { recursive: true })
      await writeFile(join(releaseRoot, "bin", "skilldrive-cli"), "#!/usr/bin/env sh\n")
      await writeFile(join(releaseRoot, "install.sh"), "#!/usr/bin/env sh\n")
      await writeFile(join(releaseRoot, "uninstall.sh"), "#!/usr/bin/env sh\n")
      await writeFile(join(releaseRoot, "lib", "skilldrive-cli.js"), "console.log('ok')\n")

      await packageModule.createTarGz({ sourceRoot: releaseRoot, outputPath: artifactPath })

      const modes = parseTarModes(gunzipSync(readFileSync(artifactPath)))
      const topLevel = basename(releaseRoot)

      expect(modes.get(`${topLevel}/bin/skilldrive-cli`)).toBe(0o755)
      expect(modes.get(`${topLevel}/install.sh`)).toBe(0o755)
      expect(modes.get(`${topLevel}/uninstall.sh`)).toBe(0o755)
      expect(modes.get(`${topLevel}/lib/skilldrive-cli.js`)).toBe(0o644)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
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

  it("checks install target executability before running the installed command", () => {
    const installScript = readFileSync(
      join(process.cwd(), "scripts", "linux-cli", "install.sh"),
      "utf8"
    )

    expect(installScript).toContain('run mkdir -p "$prefix/releases" "$bin_dir" "$tmp_dir"')
    expect(installScript).toContain('release_command="$release_dir/bin/skilldrive-cli"')
    expect(installScript).toContain('chmod 755 "$release_command"')
    expect(installScript).toContain('[ -f "$release_command" ] || fail')
    expect(installScript).toContain('[ -x "$release_command" ] || fail')
    expect(installScript).toContain('[ -x "$command_link" ] || fail')
  })
})
