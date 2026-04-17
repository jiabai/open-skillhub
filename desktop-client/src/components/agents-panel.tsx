const agents = [
  {
    name: "Claude Code",
    detail: "Adapter layer ready for code-focused agents."
  },
  {
    name: "Codex",
    detail: "Distributed updates can target this workspace-aware agent."
  },
  {
    name: "Gemini CLI",
    detail: "Kept visible as an approved distribution target."
  }
]

export function AgentsPanel() {
  return (
    <section
      aria-labelledby="agents-heading"
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
          Agents
        </span>
        <h2 id="agents-heading" style={{ margin: "0.3rem 0 0", fontSize: "1.35rem" }}>
          Distribution targets
        </h2>
      </div>

      <div style={{ display: "grid", gap: "0.65rem" }}>
        {agents.map((agent) => (
          <article
            key={agent.name}
            style={{
              display: "grid",
              gap: "0.25rem",
              padding: "0.85rem",
              borderRadius: "0.85rem",
              background: "rgba(12, 16, 22, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.06)"
            }}
          >
            <strong>{agent.name}</strong>
            <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.5 }}>{agent.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
