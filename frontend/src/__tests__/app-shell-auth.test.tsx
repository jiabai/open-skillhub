import { fireEvent, render, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

import { AppShell } from "@/components/app/app-shell"

const replaceMock = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile",
  useRouter: () => ({ replace: replaceMock })
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect, ...props }: { children: ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <div />
}))

let storedTokens: { access_token: string; refresh_token: string } | null = null

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    getStoredTokens: () => storedTokens
  }
})

describe("AppShell auth guard", () => {
  it("redirects to login when not authenticated", async () => {
    replaceMock.mockClear()
    storedTokens = null
    window.localStorage.removeItem("skillhub.tokens")
    render(<AppShell>content</AppShell>)
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login")
    })
  })

  it("logs out from dropdown menu", async () => {
    replaceMock.mockClear()
    storedTokens = { access_token: "token", refresh_token: "refresh" }
    window.localStorage.setItem(
      "skillhub.tokens",
      JSON.stringify({ access_token: "token", refresh_token: "refresh" })
    )
    const { findByRole, findByText } = render(<AppShell>content</AppShell>)
    const workbenchButton = await findByRole("button", { name: "工作台" })
    fireEvent.mouseDown(workbenchButton)
    fireEvent.click(workbenchButton)
    const logoutItem = await findByText("退出登录")
    fireEvent.click(logoutItem)
    await waitFor(() => {
      expect(window.localStorage.getItem("skillhub.tokens")).toBeNull()
      expect(replaceMock).toHaveBeenCalledWith("/login")
    })
  })
})
