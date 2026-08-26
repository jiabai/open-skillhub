# Local Skill Upload Description Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Local Skills ZIP uploads with real-world long descriptions succeed on strict databases instead of returning `INTERNAL_SERVER_ERROR: Upload failed`.

**Architecture:** Keep the established 500-character SkillDrive description summary contract. Add one backend domain constant/normalizer and apply it inside the shared ZIP upload coordinator before any Skill or SkillVersion persistence, while leaving archived ZIP contents untouched. Prove the fix through a Client API integration test that emulates PostgreSQL strict length enforcement despite the test suite's SQLite database.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy async, pytest/httpx, Electron/TypeScript for diagnostic-log cleanup.

---

Status: Completed (2026-08-26)
Updated: 2026-08-26

Spec: `docs/product-specs/2026-05-01-client-skills-upload.md`
Design: `docs/design-docs/client-skills-upload-api.md`
Tasks: `docs/exec-plans/completed/local-skill-upload-description-limit-tasks.md`

## Purpose / Big Picture

The desktop client is correctly reaching `POST /api/v1/client/skills/upload`, but
real packages such as `ui-ux-pro-max` carry a 914-character description. The shared
upload coordinator forwards it into two `VARCHAR(500)` fields. SQLite accepts that
test fixture shape, while deployed PostgreSQL rejects it; the route catches the
database exception as an unexpected error and returns the observed generic 500.

## Progress

- [x] Read repository, desktop, and backend governance and execution gates.
- [x] Trace Local Skills upload from Electron to backend persistence.
- [x] Parse the real failing package and survey installed description lengths.
- [x] Rank alternative hypotheses and record counter-evidence.
- [x] Update spec/design and create this plan/task checklist.
- [x] Obtain explicit user approval.
- [x] Add red strict-persistence regression coverage; both cases reproduced the generic 500 before the fix.
- [x] Implement shared description normalization.
- [x] Remove `[DEBUG-*]` instrumentation and run validation.
- [x] Archive plan/tasks and update indexes/tracker.

## Discoveries

- `ui-ux-pro-max` description length is 914; the persistence limit is 500.
- Seven installed skills have descriptions above 500, matching the reported broad failure.
- Existing upload integration coverage passes because it uses short strings on SQLite.
- Invalid archive/frontmatter cases map to 4xx; the observed generic 500 is the unexpected-exception branch.
- Remote list succeeds, making a missing `content_hash` migration less likely.

## Decisions

- Preserve the existing database columns and public schema limit; no migration is needed.
- Normalize external upload descriptions with a shared domain helper, not route-local logic.
- Apply the helper to both create and append paths because both constrained tables are written.
- Keep full uploaded content in the ZIP/version directory; only indexed summary fields are capped.
- Remove all `[DEBUG-list]` and `[DEBUG-upload]` logs after the feedback loop is green.
- Do not touch the unrelated untracked `scripts/update_public_skill.sh`.

## File Map

| File | Responsibility |
|------|----------------|
| `backend/domain/skill_description.py` | New shared description limit and deterministic normalizer |
| `backend/schemas/skill.py` | Consume the shared limit for manual create/update validation |
| `backend/models/skill.py` | Consume the shared limit for Skill persistence |
| `backend/models/skill_version.py` | Consume the shared limit for SkillVersion persistence |
| `backend/services/skill_upload.py` | Normalize ZIP/metadata descriptions before persistence and response metadata |
| `tests/test_client_skills_api.py` | Strict-persistence create/update regression tests and archive preservation assertion |
| `desktop-client/electron/main.ts` | Remove temporary `[DEBUG-*]` console instrumentation only |
| `docs/product-specs/2026-05-01-client-skills-upload.md` | User-visible long-description acceptance contract |
| `docs/design-docs/client-skills-upload-api.md` | Stable description-summary design rule |

### Task 1: Add strict-persistence regression tests

**Files:**
- Modify: `tests/test_client_skills_api.py`

- [x] **Step 1: Add a persistence guard that emulates PostgreSQL.**

Add a helper local to the test module named `_install_strict_description_guard` that wraps `SkillRepository.create`,
`SkillRepository.update`, and `SkillVersionRepository.create_version`. It must raise
an exception when a description longer than 500 reaches the repository, otherwise
delegate to the original method. This keeps the test on the real HTTP/service path
while making SQLite enforce production's constraint.

```python
def _install_strict_description_guard(monkeypatch, *, max_length: int = 500) -> None:
    original_skill_create = SkillRepository.create
    original_skill_update = SkillRepository.update
    original_version_create = SkillVersionRepository.create_version

    def assert_description_length(kwargs: dict) -> None:
        description = kwargs.get("description")
        if description is not None:
            assert len(str(description)) <= max_length

    async def strict_skill_create(self, *args, **kwargs):
        assert_description_length(kwargs)
        return await original_skill_create(self, *args, **kwargs)

    async def strict_skill_update(self, db_obj, *args, **kwargs):
        assert_description_length(kwargs)
        return await original_skill_update(self, db_obj, *args, **kwargs)

    async def strict_version_create(self, *args, **kwargs):
        assert_description_length(kwargs)
        return await original_version_create(self, *args, **kwargs)

    monkeypatch.setattr(SkillRepository, "create", strict_skill_create)
    monkeypatch.setattr(SkillRepository, "update", strict_skill_update)
    monkeypatch.setattr(SkillVersionRepository, "create_version", strict_version_create)
```

- [x] **Step 2: Add create and append cases.**

Use a 914-character description to match the observed package class. Assert `201`,
exact 500-character prefixes in response/detail/version records, and that the staged
`SKILL.md` still contains the full description.

- [x] **Step 3: Run the focused tests red.**

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_client_skills_api.py -k "long_description" -q
```

Expected before implementation: both cases fail because repository guards receive
914 characters; the HTTP response follows the generic 500 path.

### Task 2: Add the shared domain rule and minimal fix

**Files:**
- Create: `backend/domain/skill_description.py`
- Modify: `backend/schemas/skill.py`
- Modify: `backend/models/skill.py`
- Modify: `backend/models/skill_version.py`
- Modify: `backend/services/skill_upload.py`

- [x] **Step 1: Define the shared rule.**

```python
MAX_SKILL_DESCRIPTION_LENGTH = 500


def normalize_skill_description(value: object) -> str:
    return str(value or "").strip()[:MAX_SKILL_DESCRIPTION_LENGTH]
```

- [x] **Step 2: Reuse the constant in Pydantic schemas and SQLAlchemy models.**

Replace both literal `max_length=500` declarations in `SkillCreate` and
`SkillUpdate` with `MAX_SKILL_DESCRIPTION_LENGTH`.

- [x] **Step 3: Normalize at both upload entry points.**

In `upload_zip_from_path()`, normalize the metadata/frontmatter/existing fallback
before creating the version record or updating the Skill. In
`upload_zip_create_skill_from_path()`, normalize frontmatter before `create_skill()`.
Use the normalized value consistently for persisted description, response fields,
and `metadata_json`; do not rewrite archive bytes or extracted `SKILL.md`.

- [x] **Step 4: Run the red tests green.**

Run the same focused command. Expected: both long-description cases pass and the
strict repository guards see at most 500 characters.

### Task 3: Validate adjacent behavior and clean diagnostics

**Files:**
- Modify: `desktop-client/electron/main.ts`
- Modify: `docs/exec-plans/completed/local-skill-upload-description-limit-plan.md`
- Modify: `docs/exec-plans/completed/local-skill-upload-description-limit-tasks.md`

- [x] **Step 1: Run focused backend upload coverage.**

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_client_skills_api.py tests/test_skill_upload_branches.py -q
```

- [x] **Step 2: Remove tagged debug logs and prove cleanup.**

Remove `[DEBUG-list]` and `[DEBUG-upload]` console calls from `electron/main.ts`, then run:

```powershell
rg -n "\[DEBUG-" desktop-client/electron desktop-client/src backend tests
```

Expected: no matches attributable to this investigation.

- [x] **Step 3: Run required gates.**

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m mypy backend
npm.cmd --prefix desktop-client test
npm.cmd --prefix desktop-client run build
.\.venv\Scripts\python.exe scripts/validate_agents_docs.py --level ERROR
git diff --check
```

- [x] **Step 4: Close documentation.**

Record exact validation results, mark tracker work done, move this plan and its paired
task file to `docs/exec-plans/completed/`, and update both active/completed indexes.

## Validation

The focused regression test was the Phase 1 feedback loop. It failed with the observed
500 before the fix and passed after it. Final validation passed: 688 backend tests,
full Ruff, backend mypy, desktop Vitest, desktop production build, docs validation, and
`git diff --check`.

## Residual Risk After Implementation

Production logs were not locally accessible. The diagnosis is supported by the exact
914-vs-500 mismatch, strict-persistence red test, and SQLite/PostgreSQL behavior. After
deployment, retry one real upload and confirm the server log no longer enters the generic
unexpected-exception branch.
