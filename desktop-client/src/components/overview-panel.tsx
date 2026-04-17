type OverviewPanelProps = {
  isLoading: boolean
  localRecordCount: number
  pendingUpdateCount: number
  lastRefreshedAt: string
  errorMessage: string | null
}

const cardStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.15rem",
  borderRadius: "1rem",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  background: "rgba(255, 255, 255, 0.04)"
}

function MetricCard({
  label,
  value,
  detail
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div
      style={{
        ...cardStyle,
        gap: "0.5rem",
        background: "rgba(12, 16, 22, 0.76)"
      }}
    >
      <span
        style={{
          fontSize: "0.72rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#94a3b8",
          fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
        }}
      >
        {label}
      </span>
      <strong style={{ fontSize: "2rem", lineHeight: 1 }}>{value}</strong>
      <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.5 }}>{detail}</p>
    </div>
  )
}

export function OverviewPanel({
  isLoading,
  localRecordCount,
  pendingUpdateCount,
  lastRefreshedAt,
  errorMessage
}: OverviewPanelProps) {
  return (
    <section style={cardStyle} aria-labelledby="overview-heading">
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem"
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
            Overview
          </span>
          <h2 id="overview-heading" style={{ margin: "0.3rem 0 0", fontSize: "1.5rem" }}>
            Review snapshot
          </h2>
        </div>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.92rem" }}>
          {isLoading ? "Loading the latest desktop state..." : "Current state from the bridge."}
        </p>
      </div>

      {errorMessage ? (
        <p
          style={{
            margin: 0,
            padding: "0.85rem 0.95rem",
            borderRadius: "0.85rem",
            background: "rgba(248, 113, 113, 0.12)",
            color: "#fecaca",
            border: "1px solid rgba(248, 113, 113, 0.22)"
          }}
        >
          {errorMessage}
        </p>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))"
        }}
      >
        <MetricCard
          label="Pending updates"
          value={String(pendingUpdateCount)}
          detail="Items waiting for operator review."
        />
        <MetricCard
          label="Local records"
          value={String(localRecordCount)}
          detail="Distributed skills tracked in local storage."
        />
        <MetricCard
          label="Last refresh"
          value={lastRefreshedAt}
          detail="The latest bridge snapshot that fed this console."
        />
      </div>
    </section>
  )
}
