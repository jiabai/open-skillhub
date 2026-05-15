import { resolveCliApiBaseUrl, type CliConfig } from "@/cli/services/cli-config-store"
import { CliError } from "@/cli/services/cli-errors"
import type { ConfigStore } from "@/core/storage/config-store"

export async function runConfigSetCommand(args: {
  key: string
  value: string
  configStore: ConfigStore<CliConfig>
}): Promise<CliConfig> {
  if (args.key !== "api-base-url") {
    throw new CliError("validation", `Unsupported config key: ${args.key}`)
  }

  const apiBaseUrl = resolveCliApiBaseUrl({
    cliValue: args.value,
    env: {},
    config: {}
  })

  await args.configStore.update({ apiBaseUrl })

  return args.configStore.read()
}
