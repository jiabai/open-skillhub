import { ActivityPanel } from "@/components/activity-panel"
import { AgentsPanel } from "@/components/agents-panel"
import { ConfigPanel } from "@/components/config-panel"
import { ConfigStatus } from "@/components/config-status"
import { SettingsPanel } from "@/components/settings-panel"
import { Badge, Card, CardContent, CardHeader, CardTitle, Drawer } from "@/components/ui-primitives"
import type { ConfigurationPayload, ConfigurationState, ConnectionTestResult } from "@/types"
import type { AppLocale } from "@/types"
import { useI18n } from "@/i18n/use-i18n"

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
  isSavingLocale: boolean
  isOpen: boolean
  isSavingConfiguration: boolean
  isTestingConnection: boolean
  lastRefreshedAt: string
  currentLocale: AppLocale
  onClearConfiguration: () => void
  onClose: () => void
  onSaveConfiguration: (payload: ConfigurationPayload) => void
  onChangeLocale: (locale: AppLocale) => void
  onTestConnection: (payload: ConfigurationPayload) => void
}

export function SettingsDrawer({
  activity,
  bridgeStatus,
  configState,
  connectionTestResult,
  errorMessage,
  isClearingConfiguration,
  isSavingLocale,
  isOpen,
  isSavingConfiguration,
  isTestingConnection,
  lastRefreshedAt,
  currentLocale,
  onClearConfiguration,
  onClose,
  onSaveConfiguration,
  onChangeLocale,
  onTestConnection
}: SettingsDrawerProps) {
  const { dictionary } = useI18n()

  return (
    <Drawer
      open={isOpen}
      title={dictionary.settingsDrawer.title}
      description={dictionary.settingsDrawer.description}
      eyebrow={dictionary.common.settings}
      closeLabel={dictionary.common.close}
      onClose={onClose}
    >
      <SettingsPanel
        currentLocale={currentLocale}
        isSavingLocale={isSavingLocale}
        onChangeLocale={onChangeLocale}
      />

      <Card flat>
        <CardHeader>
          <CardTitle>{dictionary.settingsDrawer.bridgeStatusTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="list-stack">
            <Badge tone={configState?.hasToken ? "success" : "warning"}>
              {configState?.hasToken
                ? dictionary.settingsDrawer.tokenConfigured
                : dictionary.settingsDrawer.tokenMissing}
            </Badge>
            <p className="card__description">{bridgeStatus}</p>
            <p className="card__description">
              {dictionary.settingsDrawer.lastRefreshLabel}: {lastRefreshedAt}
            </p>
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
