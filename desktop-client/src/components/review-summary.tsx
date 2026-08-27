import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-primitives"
import { useI18n } from "@/i18n/use-i18n"

export type ReviewSummaryCheckStatus = "current" | "stale" | "missing" | "error"

type ReviewSummaryProps = {
  selectedCount: number
  blockedCount: number
  writeTargetCount: number
  lastCheckText: string
  checkStatus: ReviewSummaryCheckStatus
}

export function ReviewSummary({
  selectedCount,
  blockedCount,
  writeTargetCount,
  lastCheckText,
  checkStatus
}: ReviewSummaryProps) {
  const { dictionary } = useI18n()
  const copy = dictionary.reviewWorkspace

  return (
    <Card as="aside" className="review-summary" aria-labelledby="review-summary-heading">
      <CardHeader>
        <span className="section-heading__eyebrow">{copy.steps}</span>
        <CardTitle id="review-summary-heading">{copy.summaryTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="review-summary__connection">{copy.checkStatus[checkStatus]}</p>
        <dl className="review-summary__stats">
          <div>
            <dt>{copy.selected(selectedCount)}</dt>
            <dd>{selectedCount}</dd>
          </div>
          <div>
            <dt>{copy.blocked(blockedCount)}</dt>
            <dd>{blockedCount}</dd>
          </div>
          <div>
            <dt>{copy.writeTargets(writeTargetCount)}</dt>
            <dd>{writeTargetCount}</dd>
          </div>
        </dl>
        <p className="review-summary__check" role="status">
          {lastCheckText}
        </p>
      </CardContent>
    </Card>
  )
}
