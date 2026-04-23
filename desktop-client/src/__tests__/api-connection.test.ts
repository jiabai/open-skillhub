import { beforeEach, describe, expect, it, vi } from "vitest"

import { testApiConnection } from "@/core/runtime/api-connection"

describe("testApiConnection", () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it("times out when the backend probe does not respond", async () => {
    vi.useFakeTimers()

    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"))
        })
      })
    }) as typeof fetch

    const resultPromise = testApiConnection(
      {
        apiBaseUrl: "http://127.0.0.1:8001",
        apiToken: "ask_live_test"
      },
      undefined,
      {
        fetchImpl,
        timeoutMs: 1000
      }
    )

    await vi.advanceTimersByTimeAsync(1000)

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      message: "Connection timed out after 1 second."
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:8001/api/v1/client/skills?limit=1",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer ask_live_test"
        }
      })
    )
  })
})
