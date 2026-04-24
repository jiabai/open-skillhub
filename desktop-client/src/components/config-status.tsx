import type { ConfigurationState } from "@/types"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui-primitives"
import { useI18n } from "@/i18n/use-i18n"

type ConfigStatusProps = {
  configState: ConfigurationState | null
  isClearing: boolean
  onEdit?: () => void
  onClear: () => void
}

export function ConfigStatus({ configState, isClearing, onEdit, onClear }: ConfigStatusProps) {
  const { dictionary } = useI18n()
  const hasToken = Boolean(configState?.hasToken)

  return (
    <Card flat>
      <CardHeader>
        <div className="update-item__header">
          <CardTitle>{dictionary.configStatus.title}</CardTitle>
          <Badge tone={hasToken ? "success" : "destructive"}>
            {hasToken ? dictionary.configStatus.configured : dictionary.configStatus.missing}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <dl className="list-stack" style={{ margin: 0 }}>
          <div className="form-field">
            <dt className="muted">{dictionary.configStatus.apiBaseUrl}</dt>
            <dd className="mono" style={{ margin: 0, overflowWrap: "anywhere" }}>
              {configState?.apiBaseUrl ?? dictionary.configStatus.loading}
            </dd>
          </div>
          <div className="form-field">
            <dt className="muted">{dictionary.configStatus.tokenSource}</dt>
            <dd style={{ margin: 0 }}>
              {configState
                ? dictionary.configStatus.sourceLabels[configState.tokenSource]
                : dictionary.configStatus.loading}
            </dd>
          </div>
          {configState?.warning ? (
            <div className="callout callout--warning">
              <dt>{dictionary.configStatus.warning}</dt>
              <dd style={{ margin: 0 }}>{configState.warning}</dd>
            </div>
          ) : null}
        </dl>

        <div className="page-intro__actions" style={{ justifyContent: "flex-start", marginTop: "1rem" }}>
          {onEdit ? (
            <Button variant="outline" size="sm" onClick={onEdit}>
              {dictionary.configStatus.edit}
            </Button>
          ) : null}
          <Button variant="destructive" size="sm" onClick={onClear} disabled={!hasToken || isClearing}>
            {isClearing ? dictionary.configStatus.clearing : dictionary.configStatus.clearSavedConfig}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
