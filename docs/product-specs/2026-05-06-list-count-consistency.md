# List Count Consistency

## Background

Some list APIs return paginated items and totals from separate database queries.
Under concurrent writes, the returned `items` and `total` may briefly describe
different snapshots.

## Goal

Make list/count behavior intentional: either use a consistent snapshot where the
database supports it, or explicitly document and test eventual consistency for
low-risk surfaces.

## Scope

- Inventory list endpoints that return `items` plus `total`.
- Decide which endpoints need stronger snapshot consistency.
- Update repository methods or transaction boundaries for selected endpoints.
- Add tests that capture the accepted behavior.

## Non-Goals

- Do not redesign pagination response shapes.
- Do not add cursor pagination in this batch.
- Do not optimize unrelated query performance unless required for correctness.

## Acceptance Criteria

- Each list/count endpoint has an explicit consistency decision.
- High-value user-facing lists use one consistent strategy.
- Tests cover the selected strategy.
- Backend and docs gates pass.

## References

- `docs/design-docs/list-count-consistency.md`
- `docs/exec-plans/active/list-count-consistency-plan.md`
