import { useEffect, useMemo, useState } from "react"

import type { ConfigurationPayload, ConfigurationState, ConnectionTestResult } from "@/types"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui-primitives"

type ConfigPanelProps = {
  configState: ConfigurationState | null
  errorMessage: string | null
  testResult: ConnectionTestResult | null
  isSaving: boolean
  isTesting: boolean
  onSave: (payload: ConfigurationPayload) => void
  onTest: (payload: ConfigurationPayload) => void
}

export function ConfigPanel({
  configState,
  errorMessage,
  testResult,
  isSaving,
  isTesting,
  onSave,
  onTest
}: ConfigPanelProps) {
  const [apiBaseUrl, setApiBaseUrl] = useState(configState?.apiBaseUrl ?? "http://127.0.0.1:8001")
  const [apiToken, setApiToken] = useState("")

  useEffect(() => {
    if (configState?.apiBaseUrl) {
      setApiBaseUrl(configState.apiBaseUrl)
    }
  }, [configState?.apiBaseUrl])

  const payload = useMemo(
    () => ({
      apiBaseUrl,
      apiToken
    }),
    [apiBaseUrl, apiToken]
  )
  const canSave = apiBaseUrl.trim().length > 0 && (apiToken.trim().length > 0 || configState?.hasToken)
  const canTest = apiBaseUrl.trim().length > 0 && (apiToken.trim().length > 0 || configState?.hasToken)

  return (
    <Card aria-labelledby="configuration-heading" flat>
      <CardHeader>
        <span className="section-heading__eyebrow">Configuration</span>
        <CardTitle id="configuration-heading">API token</CardTitle>
        <CardDescription>
          Configure the server URL and the token used by desktop sync.
        </CardDescription>
      </CardHeader>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(payload)
        }}
        className="form-stack card__content"
      >
        <label className="form-field">
          <span className="form-label">API Base URL</span>
          <input
            value={apiBaseUrl}
            onChange={(event) => setApiBaseUrl(event.target.value)}
            spellCheck={false}
            className="input mono"
          />
        </label>

        <label className="form-field">
          <span className="form-label">API Token</span>
          <input
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={configState?.hasToken ? "Leave blank to keep the current token" : ""}
            className="input mono"
          />
          <span className="muted">
            {configState?.hasToken
              ? "A token is already available; enter a new one only when rotating credentials."
              : "A token is required before review sync can start."}
          </span>
        </label>

        <div className="page-intro__actions" style={{ justifyContent: "flex-start" }}>
          <Button
            type="submit"
            disabled={!canSave || isSaving}
            variant="primary"
          >
            {isSaving ? "Saving..." : "Save configuration"}
          </Button>
          <Button
            type="button"
            onClick={() => onTest(payload)}
            disabled={!canTest || isTesting}
            variant="secondary"
          >
            {isTesting ? "Testing..." : "Test connection"}
          </Button>
        </div>
      </form>

      <CardContent>
        {testResult ? (
          <p role="status" className={testResult.ok ? "callout callout--success" : "callout callout--error"}>
            {testResult.message}
          </p>
        ) : null}

        {errorMessage ? (
          <p role="alert" className="callout callout--error">
            {errorMessage}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
