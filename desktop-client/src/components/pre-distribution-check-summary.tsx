import type {
  AgentPreDistributionCheckResult,
  PendingSyncUpdate,
  PreDistributionCheckSnapshot,
  PreDistributionVersionComparison
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

const warningComparisons: PreDistributionVersionComparison[] = [
  "installed-newer",
  "unknown",
  "error"
]

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
    warningComparisons.includes(result.versionComparison)
  )
}

function getBadgeTone(comparison: PreDistributionVersionComparison) {
  if (comparison === "installed-older") {
    return "success" as const
  }

  if (comparison === "installed-newer" || comparison === "unknown" || comparison === "error") {
    return "warning" as const
  }

  return "primary" as const
}

function getComparisonLabel(
  result: AgentPreDistributionCheckResult,
  fallbackVersion: string,
  labels: ReturnType<typeof useI18n>["dictionary"]["preDistributionCheck"]["comparisonLabels"]
): string {
  const installedVersion = formatVersion(result.installedVersion, fallbackVersion)

  switch (result.versionComparison) {
    case "not-installed":
      return labels["not-installed"]
    case "installed-older":
      return labels["installed-older"](installedVersion, result.remoteVersion)
    case "same":
      return labels.same(result.remoteVersion)
    case "installed-newer":
      return labels["installed-newer"](installedVersion, result.remoteVersion)
    case "unknown":
      return labels.unknown(installedVersion, result.remoteVersion)
    case "error":
      return labels.error(result.errorMessage ?? "Unknown error")
  }
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
            <Badge key={result.agentId} tone={getBadgeTone(result.versionComparison)}>
              {result.displayName}:{" "}
              {result.versionComparison === "not-installed"
                ? dictionary.common.nA
                : formatVersion(result.installedVersion, dictionary.common.nA)}
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
                <Badge tone={getBadgeTone(result.versionComparison)}>
                  {result.versionComparison}
                </Badge>
              </div>
              <p>
                {getComparisonLabel(
                  result,
                  dictionary.common.nA,
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
