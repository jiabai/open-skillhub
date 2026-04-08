import { beforeEach, describe, expect, it, vi } from "vitest"

type FetchResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}

const createResponse = (status: number, body: unknown): FetchResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => typeof body === "string" ? body : JSON.stringify(body),
})

describe("public skills api", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unmock("@/lib/api")
    window.localStorage.clear()
  })

  it("lists public skills with search query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse(200, { items: [], total: 0 }))
    vi.stubGlobal("fetch", fetchMock)

    const { api } = await import("@/lib/api")
    await api.listPublicSkills("starter")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/api/v1/skills/public?q=starter")
  })

  it("creates reference, clone, pin, and unpin requests with expected payloads", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createResponse(201, { id: "ref-1" }))
      .mockResolvedValueOnce(createResponse(201, { id: "clone-1" }))
      .mockResolvedValueOnce(createResponse(200, { id: "ref-1", pinned_version: "1.2.3" }))
      .mockResolvedValueOnce(createResponse(200, { id: "ref-1", pinned_version: null }))
    vi.stubGlobal("fetch", fetchMock)

    const { api } = await import("@/lib/api")
    await api.referencePublicSkill("public-1", { name: "starter-ref", pinned_version: "1.2.3" })
    await api.clonePublicSkill("public-1", { name: "starter-copy", visible: "private" })
    await api.pinReferenceSkillVersion("ref-1", "1.2.3")
    await api.unpinReferenceSkillVersion("ref-1")

    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/v1/skills/public-1/reference")
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).body).toBe(JSON.stringify({ name: "starter-ref", pinned_version: "1.2.3" }))

    expect(fetchMock.mock.calls[1]?.[0]).toContain("/api/v1/skills/public-1/clone")
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).body).toBe(JSON.stringify({ name: "starter-copy", visible: "private" }))

    expect(fetchMock.mock.calls[2]?.[0]).toContain("/api/v1/skills/ref-1/pin")
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).body).toBe(JSON.stringify({ version: "1.2.3" }))

    expect(fetchMock.mock.calls[3]?.[0]).toContain("/api/v1/skills/ref-1/unpin")
    expect((fetchMock.mock.calls[3]?.[1] as RequestInit).body).toBe(JSON.stringify({}))
  })
})
