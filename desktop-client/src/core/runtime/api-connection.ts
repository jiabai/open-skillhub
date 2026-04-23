import type { ConfigurationPayload, ConnectionTestResult } from "@/types"

import { validateApiBaseUrl } from "@/core/runtime/runtime-config-manager"

export const DEFAULT_CONNECTION_TEST_TIMEOUT_MS = 10_000

type TestApiConnectionOptions = {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatTimeoutMessage(timeoutMs: number): string {
  const seconds = Math.max(1, Math.round(timeoutMs / 1000))

  return `Connection timed out after ${seconds} second${seconds === 1 ? "" : "s"}.`
}

export async function testApiConnection(
  payload: ConfigurationPayload,
  fallbackToken?: string | null,
  options: TestApiConnectionOptions = {}
): Promise<ConnectionTestResult> {
  let apiBaseUrl: string

  try {
    apiBaseUrl = validateApiBaseUrl(payload.apiBaseUrl)
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error)
    }
  }

  const apiToken = payload.apiToken.trim() || fallbackToken?.trim() || ""

  if (!apiToken) {
    return {
      ok: false,
      message: "API token is required."
    }
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_CONNECTION_TEST_TIMEOUT_MS
  const fetchImpl = options.fetchImpl ?? fetch
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(`${apiBaseUrl}/api/v1/client/skills?limit=1`, {
      headers: {
        Authorization: `Bearer ${apiToken}`
      },
      signal: controller.signal
    })

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: `Connection failed: ${response.status} ${response.statusText}`
      }
    }

    return {
      ok: true,
      status: response.status,
      message: "Connection succeeded."
    }
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        ok: false,
        message: formatTimeoutMessage(timeoutMs)
      }
    }

    return {
      ok: false,
      message: getErrorMessage(error)
    }
  } finally {
    clearTimeout(timeoutHandle)
  }
}
