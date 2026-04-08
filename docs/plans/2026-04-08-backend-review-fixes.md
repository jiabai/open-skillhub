# Backend Review Fix Tasks

Source: strict code review for `backend/` on April 8, 2026.

Goal: fully fix the 5 highest-priority issues found in the review, with one atomic commit per completed item.

## Execution Rules

- Fix tasks in the order below.
- After each completed task:
  - run targeted verification
  - update this file status
  - create one atomic git commit
- Do not start the next task until the current one is verified and committed.

## Task List

### 1. Fix reference re-pin failure

Status: `completed`

Problem:
- Re-pinning a reference skill to a new version silently keeps the old pinned version.

Required changes:
- Make `pin_reference_version()` validate the requested target version directly.
- Do not let current `skill.pinned_version` override the requested version during pin.
- Add regression tests for:
  - first pin
  - re-pin from one version to another version

Acceptance:
- Re-pinning from `1.2.3` to `1.2.4` stores `1.2.4`.
- Existing read paths still resolve pinned versions correctly.

### 2. Enforce one reference per `(user_id, source_skill_id)`

Status: `in_progress`

Problem:
- Duplicate references to the same public source can be created.
- Public list serialization assumes uniqueness and can fail.

Required changes:
- Enforce uniqueness at service layer.
- Add database-level uniqueness constraint if needed and safe for existing data.
- Make duplicate creation return a stable conflict error.
- Add regression tests for duplicate reference creation and public list stability.

Acceptance:
- Same user cannot create two references to the same source skill.
- Public list no longer risks `MultipleResultsFound` due to duplicate references.

### 3. Make clone creation atomic

Status: `pending`

Problem:
- Clone creation can leave partial DB rows or filesystem artifacts when an intermediate step fails.

Required changes:
- Ensure clone flow is transactional from the app perspective.
- Clean up filesystem and DB artifacts on failure.
- Add regression tests for failure during clone after skill creation.

Acceptance:
- Failed clone leaves no usable partial skill row and no stray skill directory/version directory.

### 4. Remove public-source enumeration leak

Status: `pending`

Problem:
- API currently distinguishes `SKILL_NOT_FOUND` and `SKILL_NOT_PUBLIC` for arbitrary skill UUIDs.
- This leaks whether a private skill exists.

Required changes:
- Keep spec-compatible behavior where appropriate, but do not leak private-skill existence for arbitrary ids.
- Adjust service/API error behavior and tests accordingly.

Acceptance:
- Calling reference/clone on a non-public or non-existent arbitrary UUID does not reveal private skill existence.

### 5. Remove `has_clone` / `has_reference` scalability issues

Status: `pending`

Problem:
- Public list uses a `limit=500` scan and per-row lookups.
- This causes false negatives and N+1 performance issues.

Required changes:
- Move existence checks into repository-level set-based queries.
- Remove the 500-item hard cap.
- Add regression tests covering more than 500 owned skills or equivalent behavior proof.

Acceptance:
- `has_reference` and `has_clone` are computed without per-item scans across the user skill list.
- No false negative caused by an arbitrary item limit.
