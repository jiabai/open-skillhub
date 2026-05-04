import type {
  AgentPreDistributionCheckResult,
  PendingSyncUpdate,
  PreDistributionCheckSnapshot,
  PreDistributionContentComparison
} from "@/types"
import { Badge } from "@/components/ui-primitives"
import { formatDateTime } from "@/i18n/format-date"
import { useI18n } from "@/i18n/use-i18n"

type PreDistributionCheckSummaryProps = {
  pendingUpdate: PendingSyncUpdate
  snapshot: PreDistributionCheckSnapshot | null
  isChecking: boolean
  isStale: boolean
  variant: "compact" | "detailed"
}

type PreDistributionActionWarningProps = {
  pendingUpdate: PendingSyncUpdate
  snapshot: PreDistributionCheckSnapshot | null
  isStale: boolean
}

const warningComparisons: PreDistributionContentComparison[] = ["error"]

function formatVersion(value: string | null, fallback: string): string {
  return value ?? fallback
}

export function getPreDistributionCheckResults(
  pendingUpdate: PendingSyncUpdate,
  snapshot: PreDistributionCheckSnapshot | null,
  isStale: boolean
): AgentPreDistributionCheckResult[] {
  if (!snapshot || isStale) {
    return []
  }

  return Object.values(snapshot.results[pendingUpdate.remoteSkillId] ?? {}).filter(
    (result): result is AgentPreDistributionCheckResult => result !== undefined
  )
}

export function hasPreDistributionActionWarning(
  pendingUpdate: PendingSyncUpdate,
  snapshot: PreDistributionCheckSnapshot | null,
  isStale: boolean
): boolean {
  return getPreDistributionCheckResults(pendingUpdate, snapshot, isStale).some((result) =>
    warningComparisons.includes(result.contentComparison)
  )
}

export function areAllPreDistributionTargetsInstalled(
  pendingUpdate: PendingSyncUpdate,
  snapshot: PreDistributionCheckSnapshot | null,
  isStale: boolean
): boolean {
  if (!snapshot || isStale || snapshot.targetAgentIds.length === 0) {
    return false
  }

  const resultsByAgent = snapshot.results[pendingUpdate.remoteSkillId] ?? {}

  return snapshot.targetAgentIds.every(
    (agentId) => resultsByAgent[agentId]?.contentComparison === "installed"
  )
}

function getBadgeTone(comparison: PreDistributionContentComparison) {
  if (comparison === "installed") {
    return "success" as const
  }

  if (comparison === "error") {
    return "warning" as const
  }

  if (comparison === "update") {
    return "accent" as const
  }

  return "primary" as const
}

function getComparisonLabel(
  result: AgentPreDistributionCheckResult,
  labels: ReturnType<typeof useI18n>["dictionary"]["preDistributionCheck"]["comparisonLabels"]
): string {
  switch (result.contentComparison) {
    case "not-installed":
      return labels["not-installed"]
    case "installed":
      return labels.installed(result.remoteVersion)
    case "update":
      return labels.update(result.remoteVersion)
    case "error":
      return labels.error(result.errorMessage ?? "Unknown error")
  }
}

function getComparisonStatusLabel(
  comparison: PreDistributionContentComparison,
  labels: ReturnType<typeof useI18n>["dictionary"]["preDistributionCheck"]["comparisonStatusLabels"]
): string {
  return labels[comparison]
}

function getEarliestCheckedAt(results: AgentPreDistributionCheckResult[]): string | null {
  if (results.length === 0) {
    return null
  }

  return results
    .map((result) => result.checkedAt)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0]
}

export function PreDistributionActionWarning({
  pendingUpdate,
  snapshot,
  isStale
}: PreDistributionActionWarningProps) {
  const { dictionary } = useI18n()

  if (!hasPreDistributionActionWarning(pendingUpdate, snapshot, isStale)) {
    return null
  }

  return (
    <span className="precheck-action-warning">
      {dictionary.preDistributionCheck.warningBeforeDistribute}
    </span>
  )
}

export function PreDistributionCheckSummary({
  pendingUpdate,
  snapshot,
  isChecking,
  isStale,
  variant
}: PreDistributionCheckSummaryProps) {
  const { dictionary, locale } = useI18n()
  const copy = dictionary.preDistributionCheck
  const results = getPreDistributionCheckResults(pendingUpdate, snapshot, isStale)
  const earliestCheckedAt = getEarliestCheckedAt(results)
  const formattedCheckedAt = earliestCheckedAt
    ? formatDateTime(locale, earliestCheckedAt, { dateStyle: "medium", timeStyle: "short" }, "")
    : null

  if (isChecking) {
    return <p className="precheck-summary precheck-summary--muted">{copy.loading}</p>
  }

  if (isStale) {
    return <p className="precheck-summary precheck-summary--warning">{copy.stale}</p>
  }

  if (!snapshot) {
    return <p className="precheck-summary precheck-summary--muted">{copy.refreshNeeded}</p>
  }

  if (snapshot.targetAgentIds.length === 0) {
    return <p className="precheck-summary precheck-summary--warning">{copy.noTargets}</p>
  }

  if (results.length === 0) {
    return <p className="precheck-summary precheck-summary--muted">{copy.refreshNeeded}</p>
  }

  if (variant === "compact") {
    return (
      <div className="precheck-summary" aria-label={copy.targetCheckTitle}>
        <div className="precheck-summary__badges">
          {results.map((result) => (
            <Badge key={result.agentId} tone={getBadgeTone(result.contentComparison)}>
              {result.displayName}:{" "}
              {getComparisonStatusLabel(
                result.contentComparison,
                copy.comparisonStatusLabels
              )}
            </Badge>
          ))}
        </div>
        {formattedCheckedAt ? (
          <span className="precheck-summary__checked">
            {copy.lastChecked(formattedCheckedAt)}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="precheck-details" aria-label={copy.targetCheckTitle}>
      <div className="precheck-details__header">
        <strong>{copy.targetCheckTitle}</strong>
        {formattedCheckedAt ? (
          <span className="muted">{copy.lastChecked(formattedCheckedAt)}</span>
        ) : null}
      </div>
      <div className="precheck-details__grid">
        {results.map((result) => {
          const sourceLabel =
            result.installedVersionSource === null
              ? copy.versionSourceLabels.unknown
              : copy.versionSourceLabels[result.installedVersionSource]

          return (
            <div className="precheck-target" key={result.agentId}>
              <div className="precheck-target__header">
                <strong>{result.displayName}</strong>
                <Badge tone={getBadgeTone(result.contentComparison)}>
                  {getComparisonStatusLabel(
                    result.contentComparison,
                    copy.comparisonStatusLabels
                  )}
                </Badge>
              </div>
              <p>
                {getComparisonLabel(
                  result,
                  copy.comparisonLabels
                )}
              </p>
              <div className="update-item__meta">
                <Badge>
                  {copy.installedVersion(formatVersion(result.installedVersion, dictionary.common.nA))}
                </Badge>
                <Badge tone="accent">{dictionary.common.remote(result.remoteVersion)}</Badge>
                <Badge>{sourceLabel}</Badge>
              </div>
              {result.skillDir ? (
                <span className="muted mono">{copy.targetDirectory(result.skillDir)}</span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
