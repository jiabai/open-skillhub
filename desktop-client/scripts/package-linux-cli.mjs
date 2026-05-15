#!/usr/bin/env node
import { createHash } from "node:crypto"
import {
  chmod,
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import { gzipSync } from "node:zlib"
import { spawn } from "node:child_process"
import {
  basename,
  dirname,
  join,
  relative,
  resolve,
  sep
} from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const CLI_RUNTIME_DEPENDENCIES = Object.freeze([
  "commander",
  "extract-zip",
  "sql.js"
])

export const MINIMUM_NODE_MAJOR = 20

const FORBIDDEN_PACKAGE_NAMES = new Set([
  "@testing-library/jest-dom",
  "@testing-library/react",
  "@vitejs/plugin-react",
  "electron",
  "electron-builder",
  "jsdom",
  "keytar",
  "lucide-react",
  "react",
  "react-dom",
  "sharp",
  "typescript",
  "vite",
  "vitest"
])

const REQUIRED_OUTPUTS = [
  "dist-cli/skilldrive-cli.js"
]

function scriptRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..")
}

function toPosixPath(value) {
  return value.split(sep).join("/")
}

function jsonStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function packageKeyForName(packageName) {
  return `node_modules/${packageName}`
}

function resolveDependencyPackageKey(packages, parentKey, dependencyName) {
  let currentKey = parentKey

  while (currentKey) {
    const nestedKey = `${currentKey}/node_modules/${dependencyName}`

    if (packages[nestedKey]) {
      return nestedKey
    }

    const markerIndex = currentKey.lastIndexOf("/node_modules/")

    if (markerIndex === -1) {
      break
    }

    currentKey = currentKey.slice(0, markerIndex)
  }

  const rootKey = packageKeyForName(dependencyName)

  if (packages[rootKey]) {
    return rootKey
  }

  throw new Error(`Runtime dependency is missing from package-lock.json: ${dependencyName}`)
}

export function resolveRuntimeDependencyPackageKeys(packageLock, dependencyNames) {
  const packages = packageLock?.packages

  if (!packages || typeof packages !== "object") {
    throw new Error("package-lock.json is missing a packages object")
  }

  const visited = new Set()
  const queue = dependencyNames.map((dependencyName) =>
    resolveDependencyPackageKey(packages, "", dependencyName)
  )

  while (queue.length > 0) {
    const packageKey = queue.shift()

    if (!packageKey || visited.has(packageKey)) {
      continue
    }

    const packageInfo = packages[packageKey]

    if (!packageInfo) {
      throw new Error(`package-lock.json is missing ${packageKey}`)
    }

    visited.add(packageKey)

    const dependencies = packageInfo.dependencies ?? {}

    for (const dependencyName of Object.keys(dependencies).sort()) {
      queue.push(resolveDependencyPackageKey(packages, packageKey, dependencyName))
    }
  }

  return [...visited].sort()
}

export function createBinWrapper() {
  return [
    "#!/usr/bin/env sh",
    "set -eu",
    'SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)',
    'exec node "$SCRIPT_DIR/../lib/skilldrive-cli.js" "$@"',
    ""
  ].join("\n")
}

export function createLinuxCliManifest(input) {
  return {
    schemaVersion: 1,
    name: "skilldrive-cli",
    version: input.version,
    createdAt: input.createdAt,
    gitCommit: input.gitCommit,
    minimumNodeMajor: MINIMUM_NODE_MAJOR,
    entrypoint: "bin/skilldrive-cli",
    runtimeEntrypoint: "lib/skilldrive-cli.js",
    dependencyStrategy: "package-lock runtime dependency closure",
    runtimeDependencies: [...CLI_RUNTIME_DEPENDENCIES]
  }
}

function parseNodeModulesPackageName(relativePath) {
  const segments = relativePath.split("/")

  for (let index = 0; index < segments.length; index += 1) {
    if (segments[index] !== "node_modules") {
      continue
    }

    const first = segments[index + 1]

    if (!first) {
      continue
    }

    if (first.startsWith("@")) {
      const second = segments[index + 2]
      return second ? `${first}/${second}` : null
    }

    return first
  }

  return null
}

export async function assertNoForbiddenPackageContents(root) {
  const pending = [root]

  while (pending.length > 0) {
    const current = pending.pop()
    const entries = await readdir(current, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      const relativePath = toPosixPath(relative(root, fullPath))
      const topLevel = relativePath.split("/")[0]
      const packageName = parseNodeModulesPackageName(relativePath)

      if (topLevel === "dist" || topLevel === "dist-electron") {
        throw new Error(`Forbidden Linux CLI package content: ${relativePath}`)
      }

      if (packageName && FORBIDDEN_PACKAGE_NAMES.has(packageName)) {
        throw new Error(`Forbidden Linux CLI package content: ${relativePath}`)
      }

      if (entry.isDirectory()) {
        pending.push(fullPath)
      }
    }
  }
}

async function ensureRequiredOutputs(root) {
  for (const output of REQUIRED_OUTPUTS) {
    const outputPath = join(root, output)
    if (!existsSync(outputPath)) {
      throw new Error(`Required CLI build output is missing: ${output}`)
    }
  }
}

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

async function getGitCommit(root) {
  try {
    return await runCommand("git", ["rev-parse", "--short", "HEAD"], { cwd: root, capture: true })
  } catch {
    return null
  }
}

function runtimeDependencyVersions(packageLock, packageKeys) {
  return Object.fromEntries(
    packageKeys.map((packageKey) => [
      packageKey.replace(/^node_modules\//, ""),
      packageLock.packages[packageKey]?.version ?? null
    ])
  )
}

async function copyRuntimeDependencyClosure({ root, releaseRoot, packageKeys }) {
  const destinationNodeModules = join(releaseRoot, "node_modules")
  await mkdir(destinationNodeModules, { recursive: true })

  for (const packageKey of packageKeys) {
    const sourcePath = join(root, packageKey)
    const destinationPath = join(releaseRoot, packageKey)

    if (!existsSync(sourcePath)) {
      throw new Error(`Runtime dependency is missing from node_modules: ${packageKey}`)
    }

    await mkdir(dirname(destinationPath), { recursive: true })
    await cp(sourcePath, destinationPath, {
      recursive: true,
      dereference: false,
      force: true
    })
  }
}

async function copyIfExists(source, destination) {
  if (!existsSync(source)) {
    return
  }

  await mkdir(dirname(destination), { recursive: true })
  await cp(source, destination, { force: true })
}

async function writeExecutable(path, content) {
  await writeFile(path, content, "utf8")
  await chmod(path, 0o755)
}

async function collectFileEntries(root, base = root) {
  const entries = []
  const names = await readdir(root)

  names.sort()

  for (const name of names) {
    const fullPath = join(root, name)
    const entryStat = await lstat(fullPath)
    const relativePath = toPosixPath(relative(base, fullPath))

    if (entryStat.isDirectory()) {
      entries.push({
        kind: "directory",
        path: relativePath.endsWith("/") ? relativePath : `${relativePath}/`,
        fullPath,
        mode: entryStat.mode
      })
      entries.push(...await collectFileEntries(fullPath, base))
    } else if (entryStat.isFile()) {
      entries.push({
        kind: "file",
        path: relativePath,
        fullPath,
        mode: entryStat.mode,
        size: entryStat.size
      })
    } else {
      throw new Error(`Unsupported package entry type: ${relativePath}`)
    }
  }

  return entries
}

async function createSha256Sums(releaseRoot) {
  const entries = await collectFileEntries(releaseRoot)
  const lines = []

  for (const entry of entries) {
    if (entry.kind !== "file" || entry.path === "SHA256SUMS") {
      continue
    }

    const content = await readFile(entry.fullPath)
    const hash = createHash("sha256").update(content).digest("hex")
    lines.push(`${hash}  ${entry.path}`)
  }

  await writeFile(join(releaseRoot, "SHA256SUMS"), `${lines.sort().join("\n")}\n`, "utf8")
}

function splitTarPath(path) {
  if (Buffer.byteLength(path) <= 100) {
    return { name: path, prefix: "" }
  }

  const parts = path.split("/")

  for (let index = 1; index < parts.length; index += 1) {
    const prefix = parts.slice(0, index).join("/")
    const name = parts.slice(index).join("/")

    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) {
      return { name, prefix }
    }
  }

  throw new Error(`Path is too long for ustar archive: ${path}`)
}

function writeOctal(buffer, value, offset, length) {
  const valueString = value.toString(8).padStart(length - 1, "0")
  buffer.write(valueString.slice(-length + 1), offset, length - 1, "ascii")
  buffer[offset + length - 1] = 0
}

function createTarHeader(entry) {
  const header = Buffer.alloc(512)
  const { name, prefix } = splitTarPath(entry.path)
  const mode = entry.kind === "directory" ? 0o755 : (entry.mode & 0o777)
  const size = entry.kind === "directory" ? 0 : entry.size

  header.write(name, 0, 100, "utf8")
  writeOctal(header, mode, 100, 8)
  writeOctal(header, 0, 108, 8)
  writeOctal(header, 0, 116, 8)
  writeOctal(header, size, 124, 12)
  writeOctal(header, Math.floor(Date.now() / 1000), 136, 12)
  header.fill(" ", 148, 156)
  header[156] = entry.kind === "directory" ? "5".charCodeAt(0) : "0".charCodeAt(0)
  header.write("ustar", 257, 6, "ascii")
  header.write("00", 263, 2, "ascii")
  header.write("root", 265, 32, "ascii")
  header.write("root", 297, 32, "ascii")
  if (prefix) {
    header.write(prefix, 345, 155, "utf8")
  }

  let checksum = 0
  for (const byte of header) {
    checksum += byte
  }
  const checksumString = checksum.toString(8).padStart(6, "0")
  header.write(checksumString, 148, 6, "ascii")
  header[154] = 0
  header[155] = 32

  return header
}

async function createTarGz({ sourceRoot, outputPath }) {
  const parent = dirname(sourceRoot)
  const topLevel = basename(sourceRoot)
  const rawEntries = [
    {
      kind: "directory",
      path: `${topLevel}/`,
      fullPath: sourceRoot,
      mode: (await stat(sourceRoot)).mode
    },
    ...await collectFileEntries(sourceRoot)
  ]
  const buffers = []

  for (const rawEntry of rawEntries) {
    const entry = {
      ...rawEntry,
      path: rawEntry.path === `${topLevel}/`
        ? rawEntry.path
        : toPosixPath(join(topLevel, relative(sourceRoot, rawEntry.fullPath)))
          + (rawEntry.kind === "directory" ? "/" : "")
    }
    const header = createTarHeader(entry)
    buffers.push(header)

    if (entry.kind === "file") {
      const content = await readFile(rawEntry.fullPath)
      buffers.push(content)
      const remainder = content.length % 512
      if (remainder > 0) {
        buffers.push(Buffer.alloc(512 - remainder))
      }
    }
  }

  buffers.push(Buffer.alloc(1024))

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, gzipSync(Buffer.concat(buffers), { level: 9 }))
}

async function writeArtifactChecksum(artifactPath) {
  const content = await readFile(artifactPath)
  const hash = createHash("sha256").update(content).digest("hex")
  const checksumPath = `${artifactPath}.sha256`

  await writeFile(checksumPath, `${hash}  ${basename(artifactPath)}\n`, "utf8")
}

function quoteWindowsCommandArg(value) {
  return /^[A-Za-z0-9_./:-]+$/.test(value)
    ? value
    : `"${value.replace(/"/g, '\\"')}"`
}

export function createCommandSpec(command, args = [], platform = process.platform) {
  if (platform === "win32" && command === "npm") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", [command, ...args].map(quoteWindowsCommandArg).join(" ")],
      shell: false
    }
  }

  return {
    command,
    args,
    shell: platform === "win32" && command === "npm"
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const commandSpec = createCommandSpec(command, args)
    const child = spawn(commandSpec.command, commandSpec.args, {
      cwd: options.cwd,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: commandSpec.shell
    })
    const stdout = []
    const stderr = []

    if (child.stdout) {
      child.stdout.on("data", (chunk) => stdout.push(chunk))
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk) => stderr.push(chunk))
    }

    child.on("error", rejectPromise)
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolvePromise(Buffer.concat(stdout).toString("utf8").trim())
        return
      }

      rejectPromise(
        new Error(
          `${command} ${args.join(" ")} failed with exit code ${exitCode}: ${Buffer.concat(stderr).toString("utf8")}`
        )
      )
    })
  })
}

function parseOptions(argv) {
  return {
    skipBuild: argv.includes("--skip-build"),
    skipSmoke: argv.includes("--skip-smoke")
  }
}

export async function packageLinuxCli(argv = process.argv.slice(2)) {
  const root = scriptRoot()
  const options = parseOptions(argv)
  const packageJson = readJsonFile(join(root, "package.json"))
  const packageLock = readJsonFile(join(root, "package-lock.json"))
  const version = packageJson.version
  const releaseName = `skilldrive-cli-${version}-linux-node20`
  const outputDir = join(root, "dist", "linux-cli")
  const stagingDir = join(outputDir, "staging")
  const releaseRoot = join(stagingDir, releaseName)
  const artifactPath = join(outputDir, `${releaseName}.tar.gz`)

  if (!options.skipBuild) {
    await runCommand("npm", ["run", "build:cli"], { cwd: root })
  }

  await ensureRequiredOutputs(root)
  await rm(stagingDir, { recursive: true, force: true })
  await rm(artifactPath, { force: true })
  await rm(`${artifactPath}.sha256`, { force: true })
  await mkdir(join(releaseRoot, "bin"), { recursive: true })
  await mkdir(join(releaseRoot, "lib"), { recursive: true })
  await mkdir(join(releaseRoot, "docs"), { recursive: true })

  const dependencyPackageKeys = resolveRuntimeDependencyPackageKeys(
    packageLock,
    CLI_RUNTIME_DEPENDENCIES
  )
  const gitCommit = await getGitCommit(root)
  const manifest = {
    ...createLinuxCliManifest({
      version,
      gitCommit,
      createdAt: new Date().toISOString()
    }),
    releaseName,
    dependencyPackageKeys
  }
  const runtimeDependencies = {
    strategy: manifest.dependencyStrategy,
    packages: runtimeDependencyVersions(packageLock, dependencyPackageKeys)
  }

  await copyIfExists(
    join(root, "dist-cli", "skilldrive-cli.js"),
    join(releaseRoot, "lib", "skilldrive-cli.js")
  )
  await copyIfExists(
    join(root, "dist-cli", "skilldrive-cli.js.map"),
    join(releaseRoot, "lib", "skilldrive-cli.js.map")
  )
  await writeExecutable(join(releaseRoot, "bin", "skilldrive-cli"), createBinWrapper())
  await cp(join(root, "scripts", "linux-cli", "install.sh"), join(releaseRoot, "install.sh"))
  await cp(join(root, "scripts", "linux-cli", "uninstall.sh"), join(releaseRoot, "uninstall.sh"))
  await chmod(join(releaseRoot, "install.sh"), 0o755)
  await chmod(join(releaseRoot, "uninstall.sh"), 0o755)
  await copyIfExists(
    join(root, "docs", "references", "linux-cli-deployment-zh.md"),
    join(releaseRoot, "docs", "README-zh.md")
  )
  await copyRuntimeDependencyClosure({ root, releaseRoot, packageKeys: dependencyPackageKeys })
  await writeFile(join(releaseRoot, "manifest.json"), jsonStringify(manifest), "utf8")
  await writeFile(
    join(releaseRoot, "runtime-dependencies.json"),
    jsonStringify(runtimeDependencies),
    "utf8"
  )
  await assertNoForbiddenPackageContents(releaseRoot)

  if (!options.skipSmoke) {
    await runCommand("node", [join(releaseRoot, "lib", "skilldrive-cli.js"), "--help"], {
      cwd: releaseRoot
    })
    await runCommand(
      "node",
      [join(releaseRoot, "lib", "skilldrive-cli.js"), "config", "paths"],
      { cwd: releaseRoot }
    )
  }

  await createSha256Sums(releaseRoot)
  await createTarGz({ sourceRoot: releaseRoot, outputPath: artifactPath })
  await writeArtifactChecksum(artifactPath)
  await rm(stagingDir, { recursive: true, force: true })

  console.log(`Created ${toPosixPath(relative(root, artifactPath))}`)
  console.log(`Created ${toPosixPath(relative(root, `${artifactPath}.sha256`))}`)

  return {
    artifactPath,
    checksumPath: `${artifactPath}.sha256`,
    releaseRoot
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  packageLinuxCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
