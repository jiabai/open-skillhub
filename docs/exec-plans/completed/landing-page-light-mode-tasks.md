# Light-Mode Landing Page Tasks

## Task 1: Record the contract in docs

- [x] Revise `docs/design-docs/landing-page-light-mode.md`.
- [x] Add `docs/product-specs/2026-05-02-landing-page-light-mode.md`.
- [x] Add `docs/exec-plans/active/landing-page-light-mode-plan.md`.
- [x] Add this task checklist.
- [x] Update `docs/product-specs/index.md`.
- [x] Update `docs/exec-plans/active/index.md`.
- [x] Run `python scripts/validate_agents_docs.py --level ERROR`.
- [x] Expand the design doc with the `Agent Skill Control Room` visual concept.
- Validation:
  - `python scripts/validate_agents_docs.py --level ERROR` passed on 2026-05-02 with 0 errors and 0 warnings before the visual-concept expansion.
  - `python scripts/validate_agents_docs.py --level ERROR` passed on 2026-05-02 with 0 errors and 0 warnings after the visual-concept expansion.

## Task 2: Resolve public route and Shell boundary

- [x] Decide whether `/` becomes the public Landing Page and where the current authenticated home card should live.
- [x] Ensure the public Landing Page is not wrapped by `AppShell` auth redirects.
- [x] Preserve `/login` and `/register` public behavior.
- [x] Preserve authenticated Console navigation and redirect behavior.
- Dependencies: Task 1 review.
- Validation: `npm test -- --run src/__tests__/app-shell-auth.test.tsx` passed on 2026-05-02 with 7 tests; `npm run build` passed on 2026-05-02.

## Task 3: Build light-mode Landing UI

- [x] Add Landing-specific components under `frontend/src/components/landing/`.
- [x] Implement public navbar with only real routes or same-page anchors.
- [x] Implement Hero copy with product-specific positioning from the spec.
- [x] Implement `LandingControlRoomPreview` as the primary visual.
- [x] Implement Skill registry panel with safe sample Skill records.
- [x] Implement version rail showing versioned Skill progression.
- [x] Implement distribution map for API Token, Desktop Sync, and Public Catalog destinations.
- [x] Implement capability proof strip without fake ratings, fake customer counts, or fake Logo walls.
- [x] Confirm no nested cards and no decorative orb/glow background pattern.
- Dependencies: Task 2.
- Validation: `npm test -- --run src/__tests__/pages.test.tsx` passed on 2026-05-02 with 25 tests; `npm run lint` passed on 2026-05-02.

## Task 4: Add i18n and asset references

- [x] Add Landing Page strings to `frontend/src/i18n/messages/en-US.ts`.
- [x] Add Landing Page strings to `frontend/src/i18n/messages/zh-CN.ts`.
- [x] Update `frontend/src/i18n/messages/types.ts`.
- [x] Confirm no local visual assets or reference provenance are needed because the primary preview is component-rendered.
- Dependencies: Task 3.
- Validation: `npm test` passed on 2026-05-02 with 12 test files and 62 tests. No local visual assets or reference docs were needed because the preview is component-rendered.

## Task 5: Final implementation gates

- [x] Run `cd frontend && npm run lint`.
- [x] Run `cd frontend && npm test`.
- [x] Run `cd frontend && npm run build`.
- [x] Run `python scripts/validate_agents_docs.py --level ERROR`.
- [x] Update `docs/exec-plans/active/landing-page-light-mode-plan.md` with final progress, discoveries, decisions, and validation notes.
- Dependencies: Tasks 2 to 4.
- Validation:
  - `npm run lint` passed on 2026-05-02 with no warnings or errors.
  - `npm test` passed on 2026-05-02 with 12 test files and 62 tests.
  - `npm run build` passed on 2026-05-02.
  - Local runtime smoke check returned HTTP 200 for `http://127.0.0.1:3000/` on 2026-05-02.
  - `python scripts/validate_agents_docs.py --level ERROR` passed on 2026-05-02 with 0 errors and 0 warnings.
