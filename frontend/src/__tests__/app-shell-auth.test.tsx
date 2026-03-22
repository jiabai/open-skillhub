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

// Mock AlertDialog to simplify testing
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick, ...props }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}))

describe("AppShell auth guard", () => {
  it("redirects to login when not authenticated", async () => {
    replaceMock.mockClear()
    window.localStorage.removeItem("skillhub.tokens")
    render(<AppShell>content</AppShell>)
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login")
    })
  })

  it("shows authenticated view when logged in", async () => {
    // Set token to simulate authenticated user
    window.localStorage.setItem(
      "skillhub.tokens",
      JSON.stringify({ access_token: "token", refresh_token: "refresh" })
    )
    const { findByRole } = render(<AppShell>content</AppShell>)
    // Should show the workbench button (authenticated UI)
    const workbenchButton = await findByRole("button", { name: "工作台" })
    expect(workbenchButton).toBeInTheDocument()
  })
})
