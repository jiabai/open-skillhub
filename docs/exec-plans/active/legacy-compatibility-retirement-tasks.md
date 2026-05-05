# Legacy Compatibility Retirement Tasks

Status: Draft for Review
Updated: 2026-05-06

- [x] Create executable documentation package.
- [ ] Replace test/helper imports from `backend.core.security.user_state` to `backend.domain.user_status`.
- [ ] Add a validation check for forbidden legacy imports.
- [ ] Verify clone source backfill coverage and old metadata cases.
- [ ] Decide whether `_list_cloned_source_ids_legacy_fallback()` can be removed or needs a migration first.
- [ ] Add tests proving all service-layer skill errors use `SkillError`.
- [ ] Remove `_handle_legacy_skill_value_error()` only after tests prove it is unused.
- [ ] Run focused migration/skill tests.
- [ ] Run full backend/docs gates.
- [ ] Update `docs/exec-plans/tech-debt-tracker.md`.
- [ ] Archive plan and tasks.
