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

async function loadKeytar(): Promise<KeytarLike> {
  const keytarModule = (await import("keytar")) as unknown as {
    default?: KeytarLike
  } & KeytarLike

  return keytarModule.default ?? keytarModule
}

function normalizeToken(token: string): string {
  const normalized = token.trim()

  if (!normalized) {
    throw new Error("API token cannot be empty")
  }

  return normalized
}

export function createKeytarSecretStore(
  serviceName: string,
  adapter?: KeytarLike
): SecretStore {
  async function getAdapter(): Promise<KeytarLike> {
    return adapter ?? loadKeytar()
  }

  return {
    async getApiToken(): Promise<string | null> {
      return (await getAdapter()).getPassword(serviceName, SECRET_ACCOUNT)
    },
    async setApiToken(token: string): Promise<void> {
      await (await getAdapter()).setPassword(serviceName, SECRET_ACCOUNT, normalizeToken(token))
    },
    async clearApiToken(): Promise<void> {
      await (await getAdapter()).deletePassword(serviceName, SECRET_ACCOUNT)
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
