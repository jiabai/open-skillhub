import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import SSOCallbackPage from "@/app/login/sso/callback/page"

const replaceMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () =>
    new URLSearchParams(""),
}))

describe("sso callback page", () => {
  beforeEach(() => {
    replaceMock.mockReset()
    window.localStorage.clear()
    window.history.replaceState(null, "", "/login/sso/callback#access_token=token-123&refresh_token=refresh-456")
  })

  it("stores tokens from URL fragment and redirects to dashboard", async () => {
    render(<SSOCallbackPage />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard")
    })

    expect(window.localStorage.getItem("skilldrive.tokens")).toBe(
      JSON.stringify({ access_token: "token-123", refresh_token: "refresh-456" })
    )
    expect(window.location.hash).toBe("")
  })
})
