import { useEffect, useMemo, useState } from "react"

import type { ConfigurationPayload, ConfigurationState, ConnectionTestResult } from "@/types"

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
    <section
      aria-labelledby="configuration-heading"
      style={{
        display: "grid",
        gap: "1rem",
        padding: "1.15rem",
        borderRadius: "1rem",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        background: "rgba(255, 255, 255, 0.04)"
      }}
    >
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <span
          style={{
            fontSize: "0.72rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#94a3b8",
            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
          }}
        >
          Configuration
        </span>
        <h2 id="configuration-heading" style={{ margin: 0, fontSize: "1.45rem" }}>
          API token
        </h2>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(payload)
        }}
        style={{
          display: "grid",
          gap: "0.9rem"
        }}
      >
        <label style={{ display: "grid", gap: "0.45rem", color: "#cbd5e1" }}>
          <span style={{ fontWeight: 700 }}>API Base URL</span>
          <input
            value={apiBaseUrl}
            onChange={(event) => setApiBaseUrl(event.target.value)}
            spellCheck={false}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid rgba(148, 163, 184, 0.24)",
              borderRadius: "0.75rem",
              background: "rgba(7, 10, 15, 0.9)",
              color: "#f8fafc",
              padding: "0.75rem 0.85rem",
              fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
            }}
          />
        </label>

        <label style={{ display: "grid", gap: "0.45rem", color: "#cbd5e1" }}>
          <span style={{ fontWeight: 700 }}>API Token</span>
          <input
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={configState?.hasToken ? "Leave blank to keep the current token" : ""}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid rgba(148, 163, 184, 0.24)",
              borderRadius: "0.75rem",
              background: "rgba(7, 10, 15, 0.9)",
              color: "#f8fafc",
              padding: "0.75rem 0.85rem",
              fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
            }}
          />
          <span style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.45 }}>
            {configState?.hasToken
              ? "A token is already available; enter a new one only when rotating credentials."
              : "A token is required before review sync can start."}
          </span>
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem" }}>
          <button
            type="submit"
            disabled={!canSave || isSaving}
            style={{
              border: "1px solid rgba(96, 165, 250, 0.32)",
              borderRadius: "0.75rem",
              background: !canSave || isSaving ? "rgba(148, 163, 184, 0.12)" : "rgba(96, 165, 250, 0.18)",
              color: "#f8fafc",
              padding: "0.7rem 0.95rem",
              fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
              cursor: !canSave || isSaving ? "not-allowed" : "pointer"
            }}
          >
            {isSaving ? "Saving..." : "Save configuration"}
          </button>
          <button
            type="button"
            onClick={() => onTest(payload)}
            disabled={!canTest || isTesting}
            style={{
              border: "1px solid rgba(52, 211, 153, 0.3)",
              borderRadius: "0.75rem",
              background: !canTest || isTesting ? "rgba(148, 163, 184, 0.12)" : "rgba(52, 211, 153, 0.14)",
              color: "#f8fafc",
              padding: "0.7rem 0.95rem",
              fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
              cursor: !canTest || isTesting ? "not-allowed" : "pointer"
            }}
          >
            {isTesting ? "Testing..." : "Test connection"}
          </button>
        </div>
      </form>

      {testResult ? (
        <p
          role="status"
          style={{
            margin: 0,
            color: testResult.ok ? "#86efac" : "#fca5a5",
            lineHeight: 1.5
          }}
        >
          {testResult.message}
        </p>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          style={{
            margin: 0,
            color: "#fca5a5",
            lineHeight: 1.5
          }}
        >
          {errorMessage}
        </p>
      ) : null}
    </section>
  )
}
