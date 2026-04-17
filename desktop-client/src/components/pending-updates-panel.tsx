import type { PendingSyncUpdate } from "@/types"

type PendingUpdatesPanelProps = {
  pendingUpdates: PendingSyncUpdate[]
  busyUpdateId: string | null
  isLoading: boolean
  onDistribute: (pendingUpdate: PendingSyncUpdate) => void
}

function formatVersion(value: string | null): string {
  return value ?? "n/a"
}

export function PendingUpdatesPanel({
  pendingUpdates,
  busyUpdateId,
  isLoading,
  onDistribute
}: PendingUpdatesPanelProps) {
  return (
    <section
      aria-labelledby="pending-updates-heading"
      style={{
        display: "grid",
        gap: "1rem",
        padding: "1.15rem",
        borderRadius: "1rem",
        border: "1px solid rgba(96, 165, 250, 0.2)",
        background:
          "linear-gradient(180deg, rgba(13, 19, 28, 0.95) 0%, rgba(10, 14, 20, 0.88) 100%)"
      }}
    >
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
              color: "#93c5fd",
              fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
            }}
          >
            Primary surface
          </span>
          <h2 id="pending-updates-heading" style={{ margin: "0.3rem 0 0", fontSize: "1.55rem" }}>
            Pending updates
          </h2>
        </div>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.92rem" }}>
          {pendingUpdates.length} item{pendingUpdates.length === 1 ? "" : "s"} awaiting approval.
        </p>
      </div>

      {pendingUpdates.length === 0 ? (
        <div
          style={{
            padding: "1rem",
            borderRadius: "0.95rem",
            border: "1px dashed rgba(148, 163, 184, 0.24)",
            color: "#cbd5e1",
            background: "rgba(255, 255, 255, 0.03)"
          }}
        >
          {isLoading ? "Loading pending updates..." : "No pending updates are waiting for review."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {pendingUpdates.map((pendingUpdate) => {
            const isBusy = busyUpdateId === pendingUpdate.remoteSkillId

            return (
              <article
                key={pendingUpdate.remoteSkillId}
                style={{
                  display: "grid",
                  gap: "0.9rem",
                  padding: "1rem",
                  borderRadius: "0.95rem",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.07)"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "1rem"
                  }}
                >
                  <div style={{ display: "grid", gap: "0.35rem" }}>
                    <strong style={{ fontSize: "1.02rem" }}>{pendingUpdate.name}</strong>
                    <span
                      style={{
                        fontSize: "0.84rem",
                        color: "#93c5fd",
                        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
                      }}
                    >
                      {pendingUpdate.remoteSkillId}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDistribute(pendingUpdate)}
                    disabled={isBusy}
                    aria-label={`Distribute ${pendingUpdate.name}`}
                    style={{
                      border: "1px solid rgba(96, 165, 250, 0.28)",
                      borderRadius: "0.8rem",
                      background: isBusy ? "rgba(96, 165, 250, 0.18)" : "rgba(96, 165, 250, 0.28)",
                      color: "#f8fafc",
                      padding: "0.7rem 1rem",
                      minWidth: "9rem",
                      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                      cursor: isBusy ? "wait" : "pointer"
                    }}
                  >
                    {isBusy ? "Distributing..." : "Distribute"}
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "0.4rem",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
                  }}
                >
                  <p style={{ margin: 0, color: "#cbd5e1" }}>
                    Local version: <strong>{formatVersion(pendingUpdate.localVersion)}</strong>
                  </p>
                  <p style={{ margin: 0, color: "#cbd5e1" }}>
                    Remote version: <strong>{pendingUpdate.remoteVersion}</strong>
                  </p>
                </div>

                <p
                  style={{
                    margin: 0,
                    color: "#94a3b8",
                    lineHeight: 1.6
                  }}
                >
                  Review reason: {pendingUpdate.reason}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
