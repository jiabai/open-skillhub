import type { ConfigurationState } from "@/types"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui-primitives"

type ConfigStatusProps = {
  configState: ConfigurationState | null
  isClearing: boolean
  onEdit?: () => void
  onClear: () => void
}

const sourceLabels: Record<ConfigurationState["tokenSource"], string> = {
  "secret-store": "Secret store",
  environment: "Environment",
  missing: "Missing"
}

export function ConfigStatus({ configState, isClearing, onEdit, onClear }: ConfigStatusProps) {
  const hasToken = Boolean(configState?.hasToken)

  return (
    <Card flat>
      <CardHeader>
        <div className="update-item__header">
          <CardTitle>API configuration</CardTitle>
          <Badge tone={hasToken ? "success" : "destructive"}>{hasToken ? "Configured" : "Missing"}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <dl className="list-stack" style={{ margin: 0 }}>
          <div className="form-field">
            <dt className="muted">API Base URL</dt>
            <dd className="mono" style={{ margin: 0, overflowWrap: "anywhere" }}>
            {configState?.apiBaseUrl ?? "Loading"}
            </dd>
          </div>
          <div className="form-field">
            <dt className="muted">Token source</dt>
            <dd style={{ margin: 0 }}>{configState ? sourceLabels[configState.tokenSource] : "Loading"}</dd>
          </div>
          {configState?.warning ? (
            <div className="callout callout--warning">
              <dt>Warning</dt>
              <dd style={{ margin: 0 }}>{configState.warning}</dd>
            </div>
          ) : null}
        </dl>

        <div className="page-intro__actions" style={{ justifyContent: "flex-start", marginTop: "1rem" }}>
          {onEdit ? (
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          <Button variant="destructive" size="sm" onClick={onClear} disabled={!hasToken || isClearing}>
            {isClearing ? "Clearing..." : "Clear saved config"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
