# Distributed Rate-Limit Stores Tasks

Status: Draft for Review
Updated: 2026-05-06

- [x] Create executable documentation package.
- [ ] Write failing tests for shared store hit/expiry behavior.
- [ ] Write failing middleware tests proving `429` response shape is unchanged.
- [ ] Write failing download-limit tests against the store boundary.
- [ ] Implement store protocol and in-memory store.
- [ ] Add explicit settings for rate-limit store selection.
- [ ] Refactor global middleware to use the selected store.
- [ ] Refactor download limiter to use the selected store.
- [ ] Add production shared-store implementation or a guarded placeholder setting that fails clearly when selected without dependencies.
- [ ] Run focused tests and full backend/docs gates.
- [ ] Update `docs/exec-plans/tech-debt-tracker.md`.
- [ ] Archive plan and tasks.
