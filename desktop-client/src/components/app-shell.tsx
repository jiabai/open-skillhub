import type { ReactNode } from "react"
import { useCallback, useEffect, useState } from "react"

import { Boxes, ChevronsLeft, ChevronsRight, FolderOpen, House, PanelsTopLeft, RefreshCw, Settings } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Badge, Button } from "@/components/ui-primitives"
import { useI18n } from "@/i18n/use-i18n"
import type { AppTheme } from "@/types"

export type AppView = "home" | "local-skills" | "updates" | "projects"

type AppShellProps = {
  activeView: AppView
  bridgeStatus: string
  canRefresh: boolean
  canToggleTheme: boolean
  isRefreshing: boolean
  isSavingTheme: boolean
  navigationLocked: boolean
  pendingUpdateCount: number
  theme: AppTheme
  onNavigate: (view: AppView) => void
  onOpenSettings: () => void
  onRefresh: () => void
  onToggleTheme: () => void
  children: ReactNode
}

export function AppShell({
  activeView,
  bridgeStatus,
  canRefresh,
  canToggleTheme,
  isRefreshing,
  isSavingTheme,
  navigationLocked,
  pendingUpdateCount,
  theme,
  onNavigate,
  onOpenSettings,
  onRefresh,
  onToggleTheme,
  children
}: AppShellProps) {
  const { dictionary } = useI18n()

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    try {
      return window.localStorage.getItem("skilldrive:sidebarCollapsed") === "true"
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem("skilldrive:sidebarCollapsed", String(collapsed))
    } catch {
      /* ignore storage errors (private mode, quota, etc.) */
    }
  }, [collapsed])

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => !prev)
  }, [])

  const navigationItems = [
    { view: "home" as const, label: dictionary.appShell.navigation.home, Icon: House },
    { view: "updates" as const, label: dictionary.appShell.navigation.updates, Icon: RefreshCw },
    {
      view: "local-skills" as const,
      label: dictionary.appShell.navigation.localSkills,
      Icon: FolderOpen
    },
    { view: "projects" as const, label: dictionary.appShell.navigation.projects, Icon: PanelsTopLeft }
  ]

  const shellClasses = collapsed ? "app-shell app-shell--collapsed" : "app-shell"
  const ToggleIcon = collapsed ? ChevronsRight : ChevronsLeft
  const toggleLabel = collapsed ? dictionary.appShell.expandSidebar : dictionary.appShell.collapseSidebar

  return (
    <main className={shellClasses}>
      <aside className="app-sidebar">
        <div className="brand" aria-label={dictionary.appShell.desktopClientLabel}>
          <div className="brand__mark" aria-hidden="true">
            <Boxes className="brand__mark-icon" />
          </div>
          <div className="brand__copy">
            <p className="brand__title">{dictionary.appShell.brandTitle}</p>
            <p className="brand__subtitle">{dictionary.appShell.brandSubtitle}</p>
          </div>
        </div>

        <nav className="app-nav" aria-label={dictionary.appShell.desktopClientLabel}>
          {navigationItems.map(({ view, label, Icon }) => (
            <Button
              aria-current={activeView === view ? "page" : undefined}
              aria-label={label}
              className="app-nav__button"
              disabled={navigationLocked}
              key={view}
              title={label}
              variant={activeView === view ? "nav-active" : "ghost"}
              onClick={() => onNavigate(view)}
            >
              <Icon aria-hidden="true" className="app-nav__icon" />
              <span className="btn__label">{label}</span>
            </Button>
          ))}
        </nav>

        <div className="app-sidebar__footer">
          <div
            aria-label={bridgeStatus}
            className="app-sidebar__status"
            role="status"
            title={bridgeStatus}
          >
            <span aria-hidden="true" className="app-sidebar__status-dot" />
            <span className="app-sidebar__footer-copy">{bridgeStatus}</span>
          </div>
          <Button
            aria-expanded={!collapsed}
            aria-label={toggleLabel}
            className="sidebar-toggle-btn"
            disabled={navigationLocked}
            title={toggleLabel}
            variant="ghost"
            onClick={toggleSidebar}
          >
            <ToggleIcon aria-hidden="true" className="sidebar-toggle-btn__icon" />
          </Button>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="workspace-toolbar">
          <div className="workspace-toolbar__actions">
            <Badge tone={pendingUpdateCount > 0 ? "warning" : "success"}>
              {dictionary.common.pending(pendingUpdateCount)}
            </Badge>
            <Button
              disabled={!canRefresh || isRefreshing || navigationLocked}
              title={isRefreshing ? dictionary.common.refreshing : dictionary.common.refresh}
              variant="outline"
              onClick={onRefresh}
            >
              <RefreshCw
                aria-hidden="true"
                className={isRefreshing ? "refresh-icon is-spinning" : "refresh-icon"}
              />
              <span className="btn__label">
                {isRefreshing ? dictionary.common.refreshing : dictionary.common.refresh}
              </span>
            </Button>
            <ThemeToggle
              disabled={!canToggleTheme || isSavingTheme || navigationLocked}
              theme={theme}
              onToggleTheme={onToggleTheme}
            />
            <Button
              aria-label={dictionary.common.settings}
              disabled={navigationLocked}
              title={dictionary.common.settings}
              variant="outline"
              onClick={onOpenSettings}
            >
              <Settings aria-hidden="true" className="workspace-toolbar__icon" />
              <span className="btn__label">{dictionary.common.settings}</span>
            </Button>
          </div>
        </header>

        <div className="app-main">{children}</div>
      </div>
    </main>
  )
}
