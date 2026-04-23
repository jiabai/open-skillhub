import { ActivityPanel } from "@/components/activity-panel"
import { AgentsPanel } from "@/components/agents-panel"
import { ConfigPanel } from "@/components/config-panel"
import { ConfigStatus } from "@/components/config-status"
import { Badge, Card, CardContent, CardHeader, CardTitle, Drawer } from "@/components/ui-primitives"
import type { ConfigurationPayload, ConfigurationState, ConnectionTestResult } from "@/types"

type ActivityEntry = {
  id: string
  title: string
  detail: string
  timestamp: string
  tone: "neutral" | "success" | "warning"
}

type SettingsDrawerProps = {
  activity: ActivityEntry[]
  bridgeStatus: string
  configState: ConfigurationState | null
  connectionTestResult: ConnectionTestResult | null
  errorMessage: string | null
  isClearingConfiguration: boolean
  isOpen: boolean
  isSavingConfiguration: boolean
  isTestingConnection: boolean
  lastRefreshedAt: string
  onClearConfiguration: () => void
  onClose: () => void
  onSaveConfiguration: (payload: ConfigurationPayload) => void
  onTestConnection: (payload: ConfigurationPayload) => void
}

export function SettingsDrawer({
  activity,
  bridgeStatus,
  configState,
  connectionTestResult,
  errorMessage,
  isClearingConfiguration,
  isOpen,
  isSavingConfiguration,
  isTestingConnection,
  lastRefreshedAt,
  onClearConfiguration,
  onClose,
  onSaveConfiguration,
  onTestConnection
}: SettingsDrawerProps) {
  return (
    <Drawer
      open={isOpen}
      title="Desktop settings"
      description="Connection, distribution targets, and recent local activity."
      onClose={onClose}
    >
      <Card flat>
        <CardHeader>
          <CardTitle>Bridge status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="list-stack">
            <Badge tone={configState?.hasToken ? "success" : "warning"}>
              {configState?.hasToken ? "Token configured" : "Token missing"}
            </Badge>
            <p className="card__description">{bridgeStatus}</p>
            <p className="card__description">Last refresh: {lastRefreshedAt}</p>
          </div>
        </CardContent>
      </Card>

      <ConfigStatus
        configState={configState}
        isClearing={isClearingConfiguration}
        onClear={onClearConfiguration}
      />

      <ConfigPanel
        configState={configState}
        errorMessage={errorMessage}
        testResult={connectionTestResult}
        isSaving={isSavingConfiguration}
        isTesting={isTestingConnection}
        onSave={onSaveConfiguration}
        onTest={onTestConnection}
      />

      <AgentsPanel />
      <ActivityPanel entries={activity} />
    </Drawer>
  )
}
