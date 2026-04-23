import type { SecretStore } from "@/core/storage/secret-store"

export type ApiTokenBootstrapSource = "secret-store" | "environment" | "missing"

export interface ApiTokenBootstrapResult {
  apiToken: string | null
  source: ApiTokenBootstrapSource
  persistedEnvironmentToken: boolean
  secretStoreAvailable: boolean
  warning: string | null
}

interface ResolveApiTokenBootstrapOptions {
  secretStore: SecretStore
  envToken?: string
}

function normalizeOptionalToken(token: string | null | undefined): string | null {
  const normalized = token?.trim()
  return normalized ? normalized : null
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function resolveApiTokenBootstrap(
  options: ResolveApiTokenBootstrapOptions
): Promise<ApiTokenBootstrapResult> {
  const envToken = normalizeOptionalToken(options.envToken)

  try {
    const storedToken = normalizeOptionalToken(await options.secretStore.getApiToken())

    if (storedToken) {
      return {
        apiToken: storedToken,
        source: "secret-store",
        persistedEnvironmentToken: false,
        secretStoreAvailable: true,
        warning: null
      }
    }

    if (envToken) {
      await options.secretStore.setApiToken(envToken)

      return {
        apiToken: envToken,
        source: "environment",
        persistedEnvironmentToken: true,
        secretStoreAvailable: true,
        warning: null
      }
    }

    return {
      apiToken: null,
      source: "missing",
      persistedEnvironmentToken: false,
      secretStoreAvailable: true,
      warning: null
    }
  } catch (error) {
    const warning = `Secret store unavailable during API token bootstrap: ${getErrorMessage(error)}`

    return {
      apiToken: envToken,
      source: envToken ? "environment" : "missing",
      persistedEnvironmentToken: false,
      secretStoreAvailable: false,
      warning
    }
  }
}
