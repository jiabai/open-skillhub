import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

import { RuntimeConfigContext } from "@/components/app/runtime-config-provider"
import { api } from "@/lib/api"
import { __setRuntimeConfigForTests, getRuntimeConfigSnapshot } from "@/lib/runtime-config"
import { DEFAULT_USER_STATUS } from "@/lib/user-status"
import { AppShell } from "@/components/app/app-shell"

const replaceMock = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile",
  useRouter: () => ({ replace: replaceMock }),
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
  DropdownMenuSeparator: () => <div />,
}))

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

function renderWithRuntimeConfig(node: ReactNode) {
  return render(
    <RuntimeConfigContext.Provider value={{ config: getRuntimeConfigSnapshot(), isLoading: false }}>
      {node}
    </RuntimeConfigContext.Provider>
  )
}

describe("AppShell auth guard", () => {
  it("redirects to login when not authenticated", async () => {
    replaceMock.mockClear()
    window.localStorage.removeItem("skillhub.tokens")
    renderWithRuntimeConfig(<AppShell>content</AppShell>)
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login")
    })
  })

  it("clears invalid tokens and redirects to login when session validation fails", async () => {
    replaceMock.mockClear()
    vi.mocked(api.getMe).mockRejectedValueOnce(new Error("unauthorized"))
    window.localStorage.setItem("skillhub.tokens", JSON.stringify({ access_token: "stale", refresh_token: "refresh" }))

    renderWithRuntimeConfig(<AppShell>content</AppShell>)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login")
    })
    expect(window.localStorage.getItem("skillhub.tokens")).toBeNull()
  })

  it("shows no-rbac navigation when logged in", async () => {
    __setRuntimeConfigForTests({ capabilities: { rbac: false, no_rbac_mode: true, audit_log: true } })
    window.localStorage.setItem("skillhub.tokens", JSON.stringify({ access_token: "token", refresh_token: "refresh" }))

    renderWithRuntimeConfig(<AppShell>content</AppShell>)

    expect(await screen.findByRole("button", { name: "Workbench" })).toBeInTheDocument()
    expect(await screen.findAllByText("Public Skills")).not.toHaveLength(0)
    expect(await screen.findAllByText("My Skills")).not.toHaveLength(0)
    expect(await screen.findAllByText("Tokens")).not.toHaveLength(0)
    expect(screen.queryByText("Audit")).not.toBeInTheDocument()
    expect(screen.queryByText("Users")).not.toBeInTheDocument()
  })

  it("shows rbac navigation when rbac mode is enabled", async () => {
    __setRuntimeConfigForTests({ capabilities: { rbac: true, no_rbac_mode: false, audit_log: true } })
    vi.mocked(api.getMe).mockResolvedValueOnce({
      id: "user-1",
      email: "admin@example.com",
      username: "admin",
      is_active: true,
      is_superuser: true,
      enterprise_id: null,
      team_id: null,
      role: "admin",
      status: DEFAULT_USER_STATUS,
      created_at: "2026-04-08T00:00:00Z",
      updated_at: "2026-04-08T00:00:00Z",
    } as any)
    window.localStorage.setItem("skillhub.tokens", JSON.stringify({ access_token: "token", refresh_token: "refresh" }))

    renderWithRuntimeConfig(<AppShell>content</AppShell>)

    expect(await screen.findByText("Governed console")).toBeInTheDocument()
    expect(await screen.findAllByText("Overview")).not.toHaveLength(0)
    expect(await screen.findAllByText("Skills")).not.toHaveLength(0)
    expect(await screen.findAllByText("Public Skills")).not.toHaveLength(0)
    expect(screen.queryByText("My Skills")).not.toBeInTheDocument()
  })

  it("calls backend logout before redirecting to login", async () => {
    replaceMock.mockClear()
    __setRuntimeConfigForTests({ capabilities: { rbac: false, no_rbac_mode: true, audit_log: true } })
    vi.mocked(api.getMe).mockResolvedValueOnce({
      id: "user-1",
      email: "user@example.com",
      username: "user",
      is_active: true,
      is_superuser: false,
      enterprise_id: null,
      team_id: null,
      role: "member",
      status: DEFAULT_USER_STATUS,
      created_at: "2026-04-08T00:00:00Z",
      updated_at: "2026-04-08T00:00:00Z",
    } as any)
    vi.mocked(api.logout).mockResolvedValueOnce(undefined)
    window.localStorage.setItem("skillhub.tokens", JSON.stringify({ access_token: "token", refresh_token: "refresh" }))

    renderWithRuntimeConfig(<AppShell>content</AppShell>)

    await screen.findByRole("button", { name: "Workbench" })
    fireEvent.click(screen.getAllByText("Sign Out")[0])
    fireEvent.click(screen.getAllByText("Sign Out")[1])

    await waitFor(() => {
      expect(api.logout).toHaveBeenCalledTimes(1)
      expect(replaceMock).toHaveBeenCalledWith("/login")
    })
    expect(window.localStorage.getItem("skillhub.tokens")).toBeNull()
  })
})
