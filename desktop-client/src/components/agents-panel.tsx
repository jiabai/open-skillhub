import type { AgentDetectionSnapshot } from "@/types"
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui-primitives"
import { useI18n } from "@/i18n/use-i18n"

type AgentsPanelProps = {
  detectionSnapshot: AgentDetectionSnapshot | null
  isRefreshing: boolean
  onRefresh: () => void
}

export function AgentsPanel({ detectionSnapshot, isRefreshing, onRefresh }: AgentsPanelProps) {
  const { dictionary } = useI18n()
  const copy = dictionary.agentsPanel

  // Sort agents: installed first, then missing
  const sortedAgentStatuses = detectionSnapshot
    ? [...detectionSnapshot.agentStatuses].sort((a, b) => {
        if (a.installed === b.installed) return 0
        return a.installed ? -1 : 1
      })
    : []

  return (
    <Card aria-labelledby="agents-heading" flat>
      <CardHeader>
        <div className="page-intro">
          <div className="section-heading">
            <span className="section-heading__eyebrow">{copy.eyebrow}</span>
            <CardTitle id="agents-heading">{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </div>
          <Button variant="secondary" disabled={isRefreshing} onClick={onRefresh}>
            {isRefreshing ? copy.rediscovering : copy.rediscover}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {!detectionSnapshot ? (
          <div className="callout">{copy.noSnapshot}</div>
        ) : (
          <div className="list-stack">
            <p className="card__description">
              {copy.summary(
                detectionSnapshot.installedAgentIds.length,
                detectionSnapshot.supportedAgentCount
              )}
            </p>
            {sortedAgentStatuses.map((agent) => {
              const statusLabel = agent.installed
                ? agent.source === "environment"
                  ? copy.statusLabels.environment
                  : copy.statusLabels.autoDetected
                : copy.statusLabels.missing

              return (
                <article className="update-item" key={agent.agentId}>
                  <div className="update-item__header">
                    <strong>{agent.displayName}</strong>
                    <Badge tone={agent.installed ? "success" : "warning"}>
                      {agent.installed ? copy.statusLabels.installed : copy.statusLabels.missing}
                    </Badge>
                  </div>
                  <div className="update-item__meta">
                    <Badge>{statusLabel}</Badge>
                  </div>
                  {agent.targetPaths.length > 0 ? (
                    <p className="card__description mono">
                      {copy.targetPath(agent.targetPaths.join(", "))}
                    </p>
                  ) : (
                    <p className="card__description mono">
                      {copy.detectionDirs(agent.detectionDirs.join(", "))}
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
