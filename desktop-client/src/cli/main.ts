#!/usr/bin/env node
import { Command } from "commander"

import { getAgentAdapter, hasAgentAdapter } from "@/adapters/agents/registry"
import { runConfigSetCommand } from "@/cli/commands/config"
import { runDetectCommand } from "@/cli/commands/detect"
import { runInstallCommand } from "@/cli/commands/install"
import { runSyncCommand } from "@/cli/commands/sync"
import { resolveCliAppPaths } from "@/cli/services/cli-app-paths"
import {
  createCliConfigStore,
  resolveCliApiBaseUrl,
  resolveCliApiToken
} from "@/cli/services/cli-config-store"
import { CliError } from "@/cli/services/cli-errors"
import {
  renderDetectOutput,
  renderDistributionResults,
  renderJsonOutput,
  renderPlanOutput
} from "@/cli/services/cli-output"
import { createHttpCliSyncApiClient } from "@/cli/services/cli-sync-service"
import { createCliSyncStateStore } from "@/cli/services/cli-sync-state"
import type { CliDistributionScope } from "@/cli/services/cli-targets"
import { createAgentPathsConfigStore } from "@/core/storage/agent-paths-config"
import type { AgentId } from "@/types"

export interface CliOutputWriters {
  stdout(value: string): void
  stderr(value: string): void
}

interface ScopeOptions {
  global?: boolean
  project?: string
}

interface AgentFilterOptions {
  agents?: string
}

function createOutputWriters(writers?: Partial<CliOutputWriters>): CliOutputWriters {
  return {
    stdout: writers?.stdout ?? ((value) => process.stdout.write(value)),
    stderr: writers?.stderr ?? ((value) => process.stderr.write(value))
  }
}

function addScopeOptions(command: Command): Command {
  return command
    .option("--global", "Use global agent skill targets")
    .option("--project <path>", "Use project-level agent skill targets for the supplied project path")
}

function resolveScope(options: ScopeOptions): CliDistributionScope {
  const hasGlobal = Boolean(options.global)
  const projectPath = options.project?.trim()

  if (hasGlobal === Boolean(projectPath)) {
    throw new CliError("validation", "Choose exactly one scope: --global or --project <path>")
  }

  return hasGlobal ? { type: "global" } : { type: "project", projectPath: projectPath as string }
}

function parseAgentFilter(options: AgentFilterOptions): AgentId[] | undefined {
  const raw = options.agents?.trim()

  if (!raw) {
    return undefined
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean) as AgentId[]
}

async function loadTargetOptions(paths: ReturnType<typeof resolveCliAppPaths>) {
  const agentPathsStore = createAgentPathsConfigStore(paths.agentPathsPath)

  return {
    agentPathsConfig: await agentPathsStore.read()
  }
}

export function mapCliErrorToExitCode(error: unknown): number {
  if (!(error instanceof CliError)) {
    return 1
  }

  switch (error.kind) {
    case "validation":
      return 1
    case "partial-failure":
      return 2
    case "no-targets":
      return 3
    case "remote":
      return 4
    case "unsupported-encrypted-download":
      return 5
  }
}

export function createSkillDriveCliProgram(writers?: Partial<CliOutputWriters>): Command {
  const output = createOutputWriters(writers)
  const program = new Command()
  let exitCode = 0

  program
    .name("skilldrive-cli")
    .description("SkillDrive Linux CLI for distributing skills to agent targets")
    .exitOverride()
    .configureOutput({
      writeOut: (value) => output.stdout(value),
      writeErr: (value) => output.stderr(value),
      outputError: (value, write) => write(value)
    })

  addScopeOptions(
    program
      .command("detect")
      .description("Detect writable SkillDrive agent targets")
      .option("--agents <ids>", "Comma-separated agent IDs to target")
      .option("--json", "Write machine-readable JSON")
  ).action(async (options: ScopeOptions & AgentFilterOptions & { json?: boolean }) => {
    const paths = resolveCliAppPaths()
    const result = await runDetectCommand({
      scope: resolveScope(options),
      agentFilter: parseAgentFilter(options),
      targetOptions: await loadTargetOptions(paths)
    })

    output.stdout(options.json ? renderJsonOutput(result) : renderDetectOutput(result.targets))
  })

  addScopeOptions(
    program
      .command("install")
      .description("Install a local skill directory or zip archive")
      .argument("<source>", "Local skill directory or .zip archive")
      .option("--agents <ids>", "Comma-separated agent IDs to target")
      .option("--overwrite", "Replace existing local destination skill directories")
      .option("--yes", "Apply the planned writes")
      .option("--json", "Write machine-readable JSON")
  ).action(async (source: string, options: ScopeOptions & AgentFilterOptions & {
    overwrite?: boolean
    yes?: boolean
    json?: boolean
  }) => {
    const paths = resolveCliAppPaths()
    const result = await runInstallCommand({
      sourcePath: source,
      scope: resolveScope(options),
      agentFilter: parseAgentFilter(options),
      overwrite: options.overwrite,
      yes: options.yes,
      json: options.json,
      cacheDir: paths.cacheDir,
      targetOptions: await loadTargetOptions(paths),
      resolveAgentAdapter: (agentId) => (hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null)
    })

    exitCode = result.exitCode
    output.stdout(
      options.json
        ? renderJsonOutput(result)
        : result.distributionResult
          ? renderDistributionResults([result.distributionResult])
          : renderPlanOutput([result.plan])
    )
  })

  addScopeOptions(
    program
      .command("sync")
      .description("Sync server-backed SkillDrive skills to agent targets")
      .option("--agents <ids>", "Comma-separated agent IDs to target")
      .option("--all", "Consider all visible server skills instead of pending updates only")
      .option("--overwrite-untracked", "Replace existing untracked local skill directories")
      .option("--yes", "Apply the planned writes")
      .option("--json", "Write machine-readable JSON")
      .option("--api-base-url <url>", "SkillDrive API base URL")
      .option("--api-token <token>", "SkillDrive API token for this invocation only")
  ).action(async (options: ScopeOptions & AgentFilterOptions & {
    all?: boolean
    overwriteUntracked?: boolean
    yes?: boolean
    json?: boolean
    apiBaseUrl?: string
    apiToken?: string
  }) => {
    const paths = resolveCliAppPaths()
    const configStore = createCliConfigStore(paths.configPath)
    const config = await configStore.read()
    const stateStore = await createCliSyncStateStore(paths.statePath)

    try {
      const apiBaseUrl = resolveCliApiBaseUrl({
        cliValue: options.apiBaseUrl,
        env: process.env,
        config
      })
      const apiToken = resolveCliApiToken({
        cliValue: options.apiToken,
        env: process.env
      })
      const result = await runSyncCommand({
        scope: resolveScope(options),
        agentFilter: parseAgentFilter(options),
        all: options.all,
        overwriteUntracked: options.overwriteUntracked,
        yes: options.yes,
        cacheDir: paths.cacheDir,
        apiClient: createHttpCliSyncApiClient({
          apiBaseUrl,
          apiToken: apiToken ?? "",
          cacheDir: paths.cacheDir
        }),
        stateStore,
        targetOptions: await loadTargetOptions(paths),
        resolveAgentAdapter: (agentId) => (hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null)
      })

      exitCode = result.exitCode
      output.stdout(
        options.json
          ? renderJsonOutput(result)
          : result.distributionResults.length > 0
            ? renderDistributionResults(result.distributionResults)
            : renderPlanOutput(result.plans)
      )
    } finally {
      await stateStore.close()
    }
  })

  const config = program.command("config").description("Inspect or update non-secret CLI config")

  config.command("show").description("Show CLI config").action(async () => {
    const paths = resolveCliAppPaths()
    const configStore = createCliConfigStore(paths.configPath)

    output.stdout(renderJsonOutput(await configStore.read()))
  })
  config.command("paths").description("Show CLI config, state, and cache paths").action(() => {
    output.stdout(renderJsonOutput(resolveCliAppPaths()))
  })
  config
    .command("set")
    .description("Set a non-secret CLI config value")
    .argument("key", "Config key")
    .argument("value", "Config value")
    .action(async (key: string, value: string) => {
      const paths = resolveCliAppPaths()
      const configStore = createCliConfigStore(paths.configPath)

      output.stdout(renderJsonOutput(await runConfigSetCommand({ key, value, configStore })))
    })

  program.hook("postAction", () => {
    process.exitCode = exitCode
  })

  return program
}

export async function runCli(argv = process.argv): Promise<number> {
  const program = createSkillDriveCliProgram()

  try {
    await program.parseAsync(argv)
    const parsedExitCode = typeof process.exitCode === "number" ? process.exitCode : 0

    return parsedExitCode > 0 ? parsedExitCode : 0
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "commander.helpDisplayed") {
      return 0
    }

    const output = createOutputWriters()
    output.stderr(`${error instanceof Error ? error.message : String(error)}\n`)
    return mapCliErrorToExitCode(error)
  }
}

if (process.argv[1]?.endsWith("skilldrive-cli.js")) {
  void runCli().then((exitCode) => {
    process.exitCode = exitCode
  })
}
