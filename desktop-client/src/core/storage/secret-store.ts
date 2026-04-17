import keytar from "keytar"

export interface SecretStore {
  getApiToken(): Promise<string | null>
  setApiToken(token: string): Promise<void>
  clearApiToken(): Promise<void>
}

export interface KeytarLike {
  getPassword(service: string, account: string): Promise<string | null>
  setPassword(service: string, account: string, password: string): Promise<void>
  deletePassword(service: string, account: string): Promise<boolean>
}

export const SECRET_ACCOUNT = "api-token"

function normalizeToken(token: string): string {
  const normalized = token.trim()

  if (!normalized) {
    throw new Error("API token cannot be empty")
  }

  return normalized
}

export function createKeytarSecretStore(
  serviceName: string,
  adapter: KeytarLike = keytar
): SecretStore {
  return {
    async getApiToken(): Promise<string | null> {
      return adapter.getPassword(serviceName, SECRET_ACCOUNT)
    },
    async setApiToken(token: string): Promise<void> {
      await adapter.setPassword(serviceName, SECRET_ACCOUNT, normalizeToken(token))
    },
    async clearApiToken(): Promise<void> {
      await adapter.deletePassword(serviceName, SECRET_ACCOUNT)
    }
  }
}

export function createInMemorySecretStore(initialToken: string | null = null): SecretStore {
  let apiToken = initialToken?.trim() || null

  return {
    async getApiToken(): Promise<string | null> {
      return apiToken
    },
    async setApiToken(token: string): Promise<void> {
      apiToken = normalizeToken(token)
    },
    async clearApiToken(): Promise<void> {
      apiToken = null
    }
  }
}
