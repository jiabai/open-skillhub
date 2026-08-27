import type { ReactNode } from "react"

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
  navigationLocked?: boolean
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
  navigationLocked = false,
  pendingUpdateCount,
  theme,
  onNavigate,
  onOpenSettings,
  onRefresh,
  onToggleTheme,
  children
}: AppShellProps) {
  const { dictionary } = useI18n()

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__top">
            <div className="brand" aria-label={dictionary.appShell.desktopClientLabel}>
              <div className="brand__mark" aria-hidden="true">
                SD
              </div>
              <div>
                <p className="brand__title">{dictionary.appShell.brandTitle}</p>
                <p className="brand__subtitle">{dictionary.appShell.brandSubtitle}</p>
              </div>
            </div>

            <div className="page-intro__actions">
              <Badge tone={pendingUpdateCount > 0 ? "warning" : "success"}>
                {dictionary.common.pending(pendingUpdateCount)}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={!canRefresh || isRefreshing || navigationLocked}
                onClick={onRefresh}
              >
                {isRefreshing ? dictionary.common.refreshing : dictionary.common.refresh}
              </Button>
              <ThemeToggle
                disabled={!canToggleTheme || isSavingTheme || navigationLocked}
                theme={theme}
                onToggleTheme={onToggleTheme}
              />
              <Button variant="outline" size="sm" onClick={onOpenSettings}>
                {dictionary.common.settings}
              </Button>
            </div>
          </div>

          <div className="app-header__top">
            <nav className="app-nav" aria-label={dictionary.appShell.desktopClientLabel}>
              <Button
                variant={activeView === "home" ? "nav-active" : "ghost"}
                size="sm"
                disabled={navigationLocked}
                onClick={() => onNavigate("home")}
              >
                {dictionary.appShell.navigation.home}
              </Button>
              <Button
                variant={activeView === "updates" ? "nav-active" : "ghost"}
                size="sm"
                disabled={navigationLocked}
                onClick={() => onNavigate("updates")}
              >
                {dictionary.appShell.navigation.updates}
              </Button>
              <Button
                variant={activeView === "local-skills" ? "nav-active" : "ghost"}
                size="sm"
                disabled={navigationLocked}
                onClick={() => onNavigate("local-skills")}
              >
                {dictionary.appShell.navigation.localSkills}
              </Button>
              <Button
                variant={activeView === "projects" ? "nav-active" : "ghost"}
                size="sm"
                disabled={navigationLocked}
                onClick={() => onNavigate("projects")}
              >
                {dictionary.appShell.navigation.projects}
              </Button>
            </nav>
            <span className="badge">{bridgeStatus}</span>
          </div>
        </div>
      </header>

      <div className="app-main">{children}</div>
    </main>
  )
}
