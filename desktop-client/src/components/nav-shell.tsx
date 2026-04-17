import type { ReactNode } from "react"

type NavShellProps = {
  bridgeStatus: string
  isRefreshing?: boolean
  onRefresh: () => void
  children: ReactNode
}

const navItems = [
  { label: "Overview", hint: "Snapshot and drift" },
  { label: "Pending updates", hint: "Review before distribute" },
  { label: "Agents", hint: "Targets and adapters" },
  { label: "Settings", hint: "Policy and bridge state" },
  { label: "Activity", hint: "Latest actions" }
]

export function NavShell({ bridgeStatus, isRefreshing, onRefresh, children }: NavShellProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(104, 114, 128, 0.22), transparent 28%), linear-gradient(180deg, #0c1117 0%, #090c11 100%)",
        color: "#e8edf2",
        fontFamily:
          '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif'
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px minmax(0, 1fr)",
          gap: "1rem",
          minHeight: "100vh",
          padding: "1rem"
        }}
      >
        <aside
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "1rem",
            padding: "1.25rem",
            borderRadius: "1.25rem",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(12, 16, 22, 0.92)",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.28)",
            backdropFilter: "blur(18px)"
          }}
        >
          <div style={{ display: "grid", gap: "1rem" }}>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "#94a3b8",
                  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
                }}
              >
                Open SkillHub
              </span>
              <h1
                style={{
                  margin: 0,
                  fontSize: "2rem",
                  lineHeight: 1.05,
                  color: "#f8fafc"
                }}
              >
                Review-first desktop console
              </h1>
              <p
                style={{
                  margin: 0,
                  color: "#94a3b8",
                  fontSize: "0.95rem",
                  lineHeight: 1.6
                }}
              >
                Keep pending updates in the foreground, then distribute only after review.
              </p>
            </div>

            <nav aria-label="Desktop sections">
              <ul style={{ display: "grid", gap: "0.55rem", padding: 0, margin: 0, listStyle: "none" }}>
                {navItems.map((item, index) => (
                  <li
                    key={item.label}
                    style={{
                      padding: "0.8rem 0.9rem",
                      borderRadius: "0.95rem",
                      background: index === 1 ? "rgba(96, 165, 250, 0.12)" : "rgba(255, 255, 255, 0.03)",
                      border: index === 1 ? "1px solid rgba(96, 165, 250, 0.24)" : "1px solid transparent"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.75rem"
                      }}
                    >
                      <strong style={{ fontSize: "0.98rem" }}>{item.label}</strong>
                      {index === 1 ? (
                        <span
                          style={{
                            padding: "0.18rem 0.5rem",
                            borderRadius: "999px",
                            background: "rgba(96, 165, 250, 0.18)",
                            color: "#bfdbfe",
                            fontSize: "0.72rem",
                            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
                          }}
                        >
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <p
                      style={{
                        margin: "0.25rem 0 0",
                        color: "#94a3b8",
                        fontSize: "0.88rem",
                        lineHeight: 1.45
                      }}
                    >
                      {item.hint}
                    </p>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              padding: "0.95rem",
              borderRadius: "1rem",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.06)"
            }}
          >
            <span
              style={{
                fontSize: "0.72rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#94a3b8",
                fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
              }}
            >
              Bridge status
            </span>
            <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.5, color: "#f8fafc" }}>
              {bridgeStatus}
            </p>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              style={{
                alignSelf: "start",
                border: "1px solid rgba(148, 163, 184, 0.22)",
                borderRadius: "0.8rem",
                background: isRefreshing ? "rgba(148, 163, 184, 0.12)" : "rgba(96, 165, 250, 0.16)",
                color: "#f8fafc",
                padding: "0.65rem 0.9rem",
                fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                cursor: isRefreshing ? "wait" : "pointer"
              }}
            >
              {isRefreshing ? "Refreshing..." : "Refresh review state"}
            </button>
          </div>
        </aside>

        <section
          style={{
            borderRadius: "1.25rem",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(8, 10, 14, 0.66)",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.22)",
            backdropFilter: "blur(20px)",
            padding: "1rem"
          }}
        >
          {children}
        </section>
      </div>
    </main>
  )
}
