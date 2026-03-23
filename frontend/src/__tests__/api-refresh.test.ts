import { beforeEach, describe, expect, it, vi } from "vitest"

type FetchResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

const createResponse = (status: number, body: unknown): FetchResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body
})

describe("api refresh token", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unmock("@/lib/api")
    window.localStorage.clear()
  })

  it("refreshes token and retries request", async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce(createResponse(401, { detail: "Unauthorized" }))
      .mockResolvedValueOnce(createResponse(200, { access_token: "new-access" }))
      .mockResolvedValueOnce(createResponse(200, { username: "demo", email: "demo@example.com" }))
    vi.stubGlobal("fetch", fetchMock)

    const { api, storeTokens, getStoredTokens } = await import("@/lib/api")
    storeTokens({ access_token: "expired", refresh_token: "refresh" })

    const user = await api.getMe()

    expect(user).toEqual({ username: "demo", email: "demo@example.com" })
    expect(getStoredTokens()).toEqual({ access_token: "new-access", refresh_token: "refresh" })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("clears tokens when refresh fails", async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce(createResponse(401, { detail: "Unauthorized" }))
      .mockResolvedValueOnce(createResponse(401, { detail: "Refresh expired" }))
    vi.stubGlobal("fetch", fetchMock)

    const { api, storeTokens, getStoredTokens } = await import("@/lib/api")
    storeTokens({ access_token: "expired", refresh_token: "refresh" })

    await expect(api.getMe()).rejects.toThrow("Refresh expired")
    expect(getStoredTokens()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("concurrent requests share single refresh", async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce(createResponse(401, { detail: "Unauthorized" }))
      .mockResolvedValueOnce(createResponse(401, { detail: "Unauthorized" }))
      .mockResolvedValueOnce(createResponse(200, { access_token: "new-access" }))
      .mockResolvedValueOnce(createResponse(200, { username: "user1", email: "user1@example.com" }))
      .mockResolvedValueOnce(createResponse(200, { username: "user2", email: "user2@example.com" }))
    vi.stubGlobal("fetch", fetchMock)

    const { api, storeTokens, getStoredTokens } = await import("@/lib/api")
    storeTokens({ access_token: "expired", refresh_token: "refresh" })

    const [user1, user2] = await Promise.all([api.getMe(), api.getMe()])

    expect(user1).toEqual({ username: "user1", email: "user1@example.com" })
    expect(user2).toEqual({ username: "user2", email: "user2@example.com" })
    expect(getStoredTokens()).toEqual({ access_token: "new-access", refresh_token: "refresh" })
    expect(fetchMock).toHaveBeenCalledTimes(5)
    const refreshCalls = fetchMock.mock.calls.filter(
      call => (call[1] as RequestInit)?.body === JSON.stringify({ refresh_token: "refresh" })
    )
    expect(refreshCalls).toHaveLength(1)
  })

  it("concurrent requests all fail when refresh fails", async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce(createResponse(401, { detail: "Unauthorized" }))
      .mockResolvedValueOnce(createResponse(401, { detail: "Unauthorized" }))
      .mockResolvedValueOnce(createResponse(401, { detail: "Refresh expired" }))
    vi.stubGlobal("fetch", fetchMock)

    const { api, storeTokens, getStoredTokens } = await import("@/lib/api")
    storeTokens({ access_token: "expired", refresh_token: "refresh" })

    const results = await Promise.allSettled([api.getMe(), api.getMe()])

    expect(results[0].status).toBe("rejected")
    expect(results[1].status).toBe("rejected")
    if (results[0].status === "rejected") {
      expect(results[0].reason.message).toBe("Refresh expired")
    }
    if (results[1].status === "rejected") {
      expect(results[1].reason.message).toBe("Refresh expired")
    }
    expect(getStoredTokens()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
