import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

import { RuntimeConfigContext } from "@/components/app/runtime-config-provider"
import { I18nProvider } from "@/i18n/i18n-provider"
import { getDictionary } from "@/i18n/get-dictionary"
import { api } from "@/lib/api"
import { __setRuntimeConfigForTests, getRuntimeConfigSnapshot } from "@/lib/runtime-config"
import { DEFAULT_USER_STATUS } from "@/lib/user-status"
import { AppShell } from "@/components/app/app-shell"

const replaceMock = vi.fn()
const refreshMock = vi.fn()
const routerMock = {
  replace: replaceMock,
  refresh: refreshMock,
}
let pathnameMock = "/profile"

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock,
  useRouter: () => routerMock,
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
    <I18nProvider locale="zh-CN" dictionary={getDictionary("zh-CN")}>
      <RuntimeConfigContext.Provider value={{ config: getRuntimeConfigSnapshot(), isLoading: false }}>
        {node}
      </RuntimeConfigContext.Provider>
    </I18nProvider>
  )
}

describe("AppShell auth guard", () => {
  beforeEach(() => {
    pathnameMock = "/profile"
  })

  it("renders the public landing route without requiring stored tokens", async () => {
    pathnameMock = "/"
    replaceMock.mockClear()
    refreshMock.mockClear()
    window.localStorage.removeItem("skilldrive.tokens")

    renderWithRuntimeConfig(<AppShell>public landing</AppShell>)

    expect(await screen.findByText("public landing")).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it("renders the public help route without requiring stored tokens", async () => {
    pathnameMock = "/help"
    replaceMock.mockClear()
    refreshMock.mockClear()
    window.localStorage.removeItem("skilldrive.tokens")

    renderWithRuntimeConfig(<AppShell>help center</AppShell>)

    expect(await screen.findByText("help center")).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it("redirects to login when not authenticated", async () => {
    replaceMock.mockClear()
    refreshMock.mockClear()
    window.localStorage.removeItem("skilldrive.tokens")
    renderWithRuntimeConfig(<AppShell>content</AppShell>)
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login")
    })
  })

  it("clears invalid tokens and redirects to login when session validation fails", async () => {
    replaceMock.mockClear()
    refreshMock.mockClear()
    vi.mocked(api.getMe).mockRejectedValueOnce(new Error("unauthorized"))
    window.localStorage.setItem("skilldrive.tokens", JSON.stringify({ access_token: "stale", refresh_token: "refresh" }))

    renderWithRuntimeConfig(<AppShell>content</AppShell>)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login")
    })
    expect(window.localStorage.getItem("skilldrive.tokens")).toBeNull()
  })

  it("shows no-rbac navigation when logged in", async () => {
    __setRuntimeConfigForTests({ capabilities: { rbac: false, no_rbac_mode: true, audit_log: true } })
    window.localStorage.setItem("skilldrive.tokens", JSON.stringify({ access_token: "token", refresh_token: "refresh" }))

    renderWithRuntimeConfig(<AppShell>content</AppShell>)

    expect(await screen.findByRole("button", { name: "工作台" })).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "帮助中心" })).toHaveAttribute("href", "/help")
    expect(await screen.findAllByText("公共 Skills")).not.toHaveLength(0)
    expect(await screen.findAllByText("我的 Skills")).not.toHaveLength(0)
    expect(await screen.findAllByText("令牌")).not.toHaveLength(0)
    expect(screen.queryByText("审计")).not.toBeInTheDocument()
    expect(screen.queryByText("用户")).not.toBeInTheDocument()
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
    window.localStorage.setItem("skilldrive.tokens", JSON.stringify({ access_token: "token", refresh_token: "refresh" }))

    renderWithRuntimeConfig(<AppShell>content</AppShell>)

    expect(await screen.findByText("治理控制台")).toBeInTheDocument()
    expect(await screen.findAllByText("概览")).not.toHaveLength(0)
    expect(await screen.findAllByText("Skills")).not.toHaveLength(0)
    expect(await screen.findAllByText("公共 Skills")).not.toHaveLength(0)
    expect(screen.queryByText("我的 Skills")).not.toBeInTheDocument()
  })

  it("switches locale by writing the cookie and refreshing the route", async () => {
    refreshMock.mockClear()
    __setRuntimeConfigForTests({ capabilities: { rbac: false, no_rbac_mode: true, audit_log: true } })
    window.localStorage.setItem("skilldrive.tokens", JSON.stringify({ access_token: "token", refresh_token: "refresh" }))
    document.cookie = "skilldrive.locale=; Max-Age=0; Path=/"

    renderWithRuntimeConfig(<AppShell>content</AppShell>)

    fireEvent.click(await screen.findByRole("button", { name: "切换到 English" }))

    expect(document.cookie).toContain("skilldrive.locale=en-US")
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("calls backend logout before redirecting to login", async () => {
    replaceMock.mockClear()
    refreshMock.mockClear()
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
    window.localStorage.setItem("skilldrive.tokens", JSON.stringify({ access_token: "token", refresh_token: "refresh" }))

    renderWithRuntimeConfig(<AppShell>content</AppShell>)

    await screen.findByRole("button", { name: "工作台" })
    fireEvent.click(screen.getAllByText("退出登录")[0])
    fireEvent.click(screen.getAllByText("退出登录")[1])

    await waitFor(() => {
      expect(api.logout).toHaveBeenCalledTimes(1)
      expect(replaceMock).toHaveBeenCalledWith("/login")
    })
    expect(window.localStorage.getItem("skilldrive.tokens")).toBeNull()
  })
})
