type ActivityEntry = {
  id: string
  title: string
  detail: string
  timestamp: string
  tone: "neutral" | "success" | "warning"
}

type ActivityPanelProps = {
  entries: ActivityEntry[]
}

const toneStyles: Record<ActivityEntry["tone"], { border: string; badge: string }> = {
  neutral: {
    border: "rgba(148, 163, 184, 0.14)",
    badge: "rgba(148, 163, 184, 0.12)"
  },
  success: {
    border: "rgba(74, 222, 128, 0.18)",
    badge: "rgba(74, 222, 128, 0.14)"
  },
  warning: {
    border: "rgba(251, 191, 36, 0.18)",
    badge: "rgba(251, 191, 36, 0.14)"
  }
}

export function ActivityPanel({ entries }: ActivityPanelProps) {
  return (
    <section
      aria-labelledby="activity-heading"
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
          Activity
        </span>
        <h2 id="activity-heading" style={{ margin: "0.3rem 0 0", fontSize: "1.35rem" }}>
          Recent actions
        </h2>
      </div>

      {entries.length === 0 ? (
        <div
          style={{
            padding: "0.95rem",
            borderRadius: "0.85rem",
            border: "1px dashed rgba(148, 163, 184, 0.24)",
            color: "#cbd5e1"
          }}
        >
          No recent actions yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.65rem" }}>
          {entries.map((entry) => {
            const styles = toneStyles[entry.tone]

            return (
              <article
                key={entry.id}
                style={{
                  display: "grid",
                  gap: "0.35rem",
                  padding: "0.9rem",
                  borderRadius: "0.9rem",
                  background: "rgba(12, 16, 22, 0.8)",
                  border: `1px solid ${styles.border}`
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <span
                    style={{
                      padding: "0.2rem 0.55rem",
                      borderRadius: "999px",
                      background: styles.badge,
                      color: "#e2e8f0",
                      fontSize: "0.72rem",
                      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
                    }}
                  >
                    {entry.timestamp}
                  </span>
                  <strong>{entry.title}</strong>
                </div>
                <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.55 }}>{entry.detail}</p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
