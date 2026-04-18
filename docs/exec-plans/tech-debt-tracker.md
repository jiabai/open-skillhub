# Tech Debt Tracker

Last updated: 2026-04-17

## High Priority

| Topic | Why it matters | Source |
|------|----------------|--------|
| Refresh token hardening | Current rotation behavior is weaker than strict single-use invalidation and reuse detection | `docs/design-docs/2026-04-12-code-review-findings.md` |
| Large backend workflow files | Oversized modules increase coordination cost and make boundary drift more likely | `docs/exec-plans/active/2026-04-10-backend-consolidation-refactor-plan.md`, `docs/exec-plans/active/error-architecture-refactor-plan.md` |
| Skills API boundary clarity | Mixed JWT and API-token semantics raise maintenance and client-integration risk | `docs/exec-plans/active/skills-api-boundary.md` |

## Medium Priority

| Topic | Why it matters | Source |
|------|----------------|--------|
| Shared enum consolidation | Duplicated raw strings can drift across backend, frontend, and tests | `docs/exec-plans/active/next-steps-user-status-followup.md` |
| Documentation freshness automation | The new docs structure exists, but it still relies on manual gardening | repository process follow-up |

## Debt Handling Rules

- Add debt here when it spans more than one file or more than one task.
- Remove or downgrade debt when a merged change clearly addresses it.
- Link back to the plan or design doc that best explains the issue.
