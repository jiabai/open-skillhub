type SettingsPanelProps = {
  bridgeStatus: string
  lastRefreshedAt: string
}

const settings = [
  {
    label: "Review policy",
    value: "Pending updates stay gated until a human reviews them."
  },
  {
    label: "Bridge access",
    value: "IPC wrapper only. No direct Node access from the renderer."
  },
  {
    label: "Storage snapshot",
    value: "Local state is refreshed before and after distribution."
  }
]

export function SettingsPanel({ bridgeStatus, lastRefreshedAt }: SettingsPanelProps) {
  return (
    <section
      aria-labelledby="settings-heading"
      style={{
        display: "grid",
        gap: "1rem",
        padding: "1.15rem",
        borderRadius: "1rem",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        background: "rgba(255, 255, 255, 0.04)"
      }}
    >
      <div>
        <span
          style={{
            fontSize: "0.72rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#94a3b8",
            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
          }}
        >
          Settings
        </span>
        <h2 id="settings-heading" style={{ margin: "0.3rem 0 0", fontSize: "1.35rem" }}>
          Review controls
        </h2>
      </div>

      <dl style={{ display: "grid", gap: "0.75rem", margin: 0 }}>
        {settings.map((setting) => (
          <div
            key={setting.label}
            style={{
              display: "grid",
              gap: "0.25rem",
              padding: "0.85rem",
              borderRadius: "0.85rem",
              background: "rgba(12, 16, 22, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.06)"
            }}
          >
            <dt style={{ fontWeight: 700 }}>{setting.label}</dt>
            <dd style={{ margin: 0, color: "#94a3b8", lineHeight: 1.5 }}>{setting.value}</dd>
          </div>
        ))}
      </dl>

      <div
        style={{
          display: "grid",
          gap: "0.5rem",
          padding: "0.85rem",
          borderRadius: "0.85rem",
          background: "rgba(96, 165, 250, 0.08)",
          border: "1px solid rgba(96, 165, 250, 0.16)"
        }}
      >
        <strong>Bridge status</strong>
        <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.5 }}>{bridgeStatus}</p>
        <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.5 }}>
          Last refresh: {lastRefreshedAt}
        </p>
      </div>
    </section>
  )
}
