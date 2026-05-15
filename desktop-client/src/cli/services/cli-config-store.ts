import { validateApiBaseUrl } from "@/core/runtime/runtime-config-manager"
import { createJsonConfigStore, type ConfigStore, type JsonRecord } from "@/core/storage/config-store"

export interface CliConfig extends JsonRecord {
  apiBaseUrl?: string
}

export interface ResolveCliApiBaseUrlInput {
  cliValue?: string | null
  env?: Partial<Pick<NodeJS.ProcessEnv, "SKILLDRIVE_API_BASE_URL">>
  config?: CliConfig
}

export interface ResolveCliApiTokenInput {
  cliValue?: string | null
  env?: Partial<Pick<NodeJS.ProcessEnv, "SKILLDRIVE_API_TOKEN">>
}

export const DEFAULT_CLI_API_BASE_URL = "http://127.0.0.1:8001"

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim()

  return trimmed ? trimmed : null
}

export function createCliConfigStore(filePath: string): ConfigStore<CliConfig> {
  return createJsonConfigStore<CliConfig>(filePath, {})
}

export function resolveCliApiBaseUrl(input: ResolveCliApiBaseUrlInput): string {
  const selected =
    normalizeOptional(input.cliValue) ??
    normalizeOptional(input.env?.SKILLDRIVE_API_BASE_URL) ??
    normalizeOptional(input.config?.apiBaseUrl) ??
    DEFAULT_CLI_API_BASE_URL

  return validateApiBaseUrl(selected)
}

export function resolveCliApiToken(input: ResolveCliApiTokenInput): string | null {
  return normalizeOptional(input.cliValue) ?? normalizeOptional(input.env?.SKILLDRIVE_API_TOKEN)
}
