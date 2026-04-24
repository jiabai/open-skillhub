import { useEffect, useMemo, useState } from "react"

import type { ConfigurationPayload, ConfigurationState, ConnectionTestResult } from "@/types"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui-primitives"
import { useI18n } from "@/i18n/use-i18n"

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
  const { dictionary } = useI18n()
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
        <span className="section-heading__eyebrow">{dictionary.configPanel.section}</span>
        <CardTitle id="configuration-heading">{dictionary.configPanel.title}</CardTitle>
        <CardDescription>{dictionary.configPanel.description}</CardDescription>
      </CardHeader>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(payload)
        }}
        className="form-stack card__content"
      >
        <label className="form-field">
          <span className="form-label">{dictionary.configPanel.apiBaseUrlLabel}</span>
          <input
            value={apiBaseUrl}
            onChange={(event) => setApiBaseUrl(event.target.value)}
            spellCheck={false}
            className="input mono"
          />
        </label>

        <label className="form-field">
          <span className="form-label">{dictionary.configPanel.apiTokenLabel}</span>
          <input
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={configState?.hasToken ? dictionary.configPanel.apiTokenPlaceholder : ""}
            className="input mono"
          />
          <span className="muted">
            {configState?.hasToken
              ? dictionary.configPanel.tokenHelpConfigured
              : dictionary.configPanel.tokenHelpMissing}
          </span>
        </label>

        <div className="page-intro__actions" style={{ justifyContent: "flex-start" }}>
          <Button type="submit" disabled={!canSave || isSaving} variant="primary">
            {isSaving
              ? dictionary.configPanel.savingConfiguration
              : dictionary.configPanel.saveConfiguration}
          </Button>
          <Button
            type="button"
            onClick={() => onTest(payload)}
            disabled={!canTest || isTesting}
            variant="secondary"
          >
            {isTesting
              ? dictionary.configPanel.testingConnection
              : dictionary.configPanel.testConnection}
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
