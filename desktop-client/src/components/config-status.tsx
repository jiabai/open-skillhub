import type { ConfigurationState } from "@/types"

type ConfigStatusProps = {
  configState: ConfigurationState | null
  isClearing: boolean
  onEdit: () => void
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
    <div
      style={{
        display: "grid",
        gap: "0.75rem",
        padding: "0.85rem",
        borderRadius: "0.85rem",
        background: "rgba(52, 211, 153, 0.08)",
        border: "1px solid rgba(52, 211, 153, 0.14)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
        <strong>API configuration</strong>
        <span
          style={{
            color: hasToken ? "#86efac" : "#fca5a5",
            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
            fontSize: "0.78rem"
          }}
        >
          {hasToken ? "Configured" : "Missing"}
        </span>
      </div>

      <dl style={{ display: "grid", gap: "0.45rem", margin: 0 }}>
        <div style={{ display: "grid", gap: "0.18rem" }}>
          <dt style={{ color: "#94a3b8", fontSize: "0.85rem" }}>API Base URL</dt>
          <dd
            style={{
              margin: 0,
              color: "#f8fafc",
              overflowWrap: "anywhere",
              fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
              fontSize: "0.88rem"
            }}
          >
            {configState?.apiBaseUrl ?? "Loading"}
          </dd>
        </div>
        <div style={{ display: "grid", gap: "0.18rem" }}>
          <dt style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Token source</dt>
          <dd style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.45 }}>
            {configState ? sourceLabels[configState.tokenSource] : "Loading"}
          </dd>
        </div>
        {configState?.warning ? (
          <div style={{ display: "grid", gap: "0.18rem" }}>
            <dt style={{ color: "#fbbf24", fontSize: "0.85rem" }}>Warning</dt>
            <dd style={{ margin: 0, color: "#fde68a", lineHeight: 1.45 }}>{configState.warning}</dd>
          </div>
        ) : null}
      </dl>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        <button
          type="button"
          onClick={onEdit}
          style={{
            border: "1px solid rgba(148, 163, 184, 0.22)",
            borderRadius: "0.75rem",
            background: "rgba(96, 165, 250, 0.14)",
            color: "#f8fafc",
            padding: "0.58rem 0.8rem",
            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
            cursor: "pointer"
          }}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!hasToken || isClearing}
          style={{
            border: "1px solid rgba(248, 113, 113, 0.28)",
            borderRadius: "0.75rem",
            background: !hasToken || isClearing ? "rgba(148, 163, 184, 0.12)" : "rgba(248, 113, 113, 0.12)",
            color: "#f8fafc",
            padding: "0.58rem 0.8rem",
            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
            cursor: !hasToken || isClearing ? "not-allowed" : "pointer"
          }}
        >
          {isClearing ? "Clearing..." : "Clear saved config"}
        </button>
      </div>
    </div>
  )
}
