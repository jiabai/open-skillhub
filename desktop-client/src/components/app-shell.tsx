import type { ReactNode } from "react"

import { Badge, Button } from "@/components/ui-primitives"
import { useI18n } from "@/i18n/use-i18n"

export type AppView = "home" | "updates"

type AppShellProps = {
  activeView: AppView
  bridgeStatus: string
  canRefresh: boolean
  isRefreshing: boolean
  pendingUpdateCount: number
  onNavigate: (view: AppView) => void
  onOpenSettings: () => void
  onRefresh: () => void
  children: ReactNode
}

export function AppShell({
  activeView,
  bridgeStatus,
  canRefresh,
  isRefreshing,
  pendingUpdateCount,
  onNavigate,
  onOpenSettings,
  onRefresh,
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
                OS
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
                disabled={!canRefresh || isRefreshing}
                onClick={onRefresh}
              >
                {isRefreshing ? dictionary.common.refreshing : dictionary.common.refresh}
              </Button>
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
                onClick={() => onNavigate("home")}
              >
                {dictionary.appShell.navigation.home}
              </Button>
              <Button
                variant={activeView === "updates" ? "nav-active" : "ghost"}
                size="sm"
                onClick={() => onNavigate("updates")}
              >
                {dictionary.appShell.navigation.updates}
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
