import type { ReactNode } from "react"

import { Badge, Button } from "@/components/ui-primitives"

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
  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__top">
            <div className="brand" aria-label="Open SkillHub Desktop">
              <div className="brand__mark" aria-hidden="true">
                OS
              </div>
              <div>
                <p className="brand__title">Open SkillHub</p>
                <p className="brand__subtitle">Desktop review client</p>
              </div>
            </div>

            <div className="page-intro__actions">
              <Badge tone={pendingUpdateCount > 0 ? "warning" : "success"}>
                {pendingUpdateCount} pending
              </Badge>
              <Button variant="outline" size="sm" disabled={!canRefresh || isRefreshing} onClick={onRefresh}>
                {isRefreshing ? "Refreshing" : "Refresh"}
              </Button>
              <Button variant="outline" size="sm" onClick={onOpenSettings}>
                Settings
              </Button>
            </div>
          </div>

          <div className="app-header__top">
            <nav className="app-nav" aria-label="Desktop client views">
              <Button
                variant={activeView === "home" ? "nav-active" : "ghost"}
                size="sm"
                onClick={() => onNavigate("home")}
              >
                Home
              </Button>
              <Button
                variant={activeView === "updates" ? "nav-active" : "ghost"}
                size="sm"
                onClick={() => onNavigate("updates")}
              >
                Updates
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
