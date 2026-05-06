# Light-Mode Landing Page

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

## Purpose / Big Picture

SkillDrive needs a public, unauthenticated Landing Page that explains the product
before users enter the authenticated Console. The visible result will be a light-mode
public page for `/` with product-specific copy, verified CTAs, local or documented
visual assets, and no false social proof.

This plan intentionally stops before implementation until the spec, design doc, and
task checklist are reviewed.

## Progress

- [x] (2026-05-02) Reviewed repository workflow, root and frontend AGENTS guidance, governance docs, execution gates, current Landing design doc, root layout, AppShell, Tailwind config, global CSS, and current home page.
- [x] (2026-05-02) Revised `docs/design-docs/landing-page-light-mode.md` to remove inaccurate routing, AppShell, token, external asset, negative tracking, and false social-proof claims.
- [x] (2026-05-02) Added product spec and this active ExecPlan for review before code changes.
- [x] (2026-05-02) Added sibling task checklist for the future implementation phase.
- [x] (2026-05-02) Updated product spec and active ExecPlan indexes.
- [x] (2026-05-02) Ran `python scripts/validate_agents_docs.py --level ERROR`; passed with 0 errors and 0 warnings.
- [x] (2026-05-02) Expanded the design direction into `Agent Skill Control Room`, including control room preview composition, product-state panels, motion rules, and responsive sizing guidance.
- [x] (2026-05-02) Re-ran `python scripts/validate_agents_docs.py --level ERROR` after visual-concept expansion; passed with 0 errors and 0 warnings.
- [x] (2026-05-02) Created `codex/landing-page-light-mode` branch for implementation.
- [x] (2026-05-02) Added failing tests proving `/` is public and the root page renders the Landing control-room content.
- [x] (2026-05-02) Implemented the public root Landing Page, Landing-specific components, i18n copy, and `AppShell` public-route boundary.
- [x] (2026-05-02) Resolved the frontend token mismatch by keeping `globals.css` theme variables in HSL values compatible with Tailwind semantic colors.
- [x] (2026-05-02) Ran focused tests: `npm test -- --run src/__tests__/app-shell-auth.test.tsx` and `npm test -- --run src/__tests__/pages.test.tsx`; both passed.
- [x] (2026-05-02) Ran `npm run lint`; passed with no warnings or errors.
- [x] (2026-05-02) Ran `npm test`; first run exposed an existing metadata title drift, then passed after aligning dictionary metadata with `SkillDrive`.
- [x] (2026-05-02) Ran `npm run build`; passed.
- [x] (2026-05-02) Started the frontend dev server on `http://127.0.0.1:3000/` and confirmed `/` returned HTTP 200.

## Surprises & Discoveries

- Observation: `frontend/src/app/layout.tsx` currently wraps all pages in `AppShell`.
  Evidence: RootLayout renders `<AppShell>{children}</AppShell>` inside the runtime and i18n providers.

- Observation: `AppShell` treats only `/login` and `/register` as public auth routes; other routes require stored access tokens or redirect to `/login`.
  Evidence: `frontend/src/components/app/app-shell.tsx` sets `isAuthRoute = pathname === "/login" || pathname === "/register"` and redirects missing-token users for all other routes.

- Observation: `frontend/src/app/page.tsx` already owns the root `/` route.
  Evidence: the current file exports `HomePage`, so adding `frontend/src/app/(landing)/page.tsx` would collide with the same route segment unless the existing root page is moved or replaced.

- Observation: `frontend/src/app/globals.css` contains project HSL tokens at top level and shadcn-generated OKLCH tokens inside `@layer base`.
  Evidence: top-level `:root` defines HSL `--primary`, `--card`, and related tokens, while the later base layer defines OKLCH `--background`, `--foreground`, and duplicates several token names.

- Observation: the earlier Landing design doc used generic task-management copy and unverified social proof.
  Evidence: it specified "Rated 4.9/5 by 2700+ customers" and "Trusted by Top-tier product companies" without a product source.

- Observation: the frontend i18n test expected `SkillDrive Console`, but the dictionaries still used `SkillDrive Console`.
  Evidence: the first full `npm test` run failed `src/__tests__/i18n-config.test.ts` on `metadata.title`.

- Observation: component-rendered preview assets were sufficient for the primary visual.
  Evidence: `LandingControlRoomPreview` renders Skill registry, version rail, and distribution map without external images or videos.

## Decision Log

- Decision: treat this as full documentation-stage work rather than a trivial copy edit.
  Rationale: the Landing Page changes public user-visible behavior and requires route, Shell, i18n, visual asset, and validation planning.
  Date/Author: 2026-05-02 / Codex

- Decision: make the public Landing Page independent from authenticated `AppShell`.
  Rationale: `AppShell` currently enforces auth redirects and is semantically the Console shell.
  Date/Author: 2026-05-02 / Codex

- Decision: remove false ratings, fake customer Logo walls, and third-party hotlinked media from the design.
  Rationale: public marketing claims and asset sources must be truthful, durable, and reviewable.
  Date/Author: 2026-05-02 / Codex

- Decision: use a product preview or capability visualization as the main visual instead of decorative orbs or glows.
  Rationale: the page should reveal the actual product or workflow, and current frontend design guidance discourages decorative orb-style backgrounds.
  Date/Author: 2026-05-02 / Codex

- Decision: make `Agent Skill Control Room` the light-mode Landing Page's named visual concept.
  Rationale: it preserves the user's desire for a memorable, high-impact first impression while tying the visual system directly to Skill registry, versioning, permission, and distribution workflows.
  Date/Author: 2026-05-02 / Codex

- Decision: make `/` the public Landing Page and leave authenticated Console entry through `/dashboard`.
  Rationale: the root route is the natural unauthenticated entry point, while existing authenticated navigation already uses `/dashboard`.
  Date/Author: 2026-05-02 / Codex

- Decision: build the primary visual from React components instead of static media.
  Rationale: component-rendered panels keep copy localizable, avoid asset licensing risk, and make product-state details testable.
  Date/Author: 2026-05-02 / Codex

## Outcomes & Retrospective

Implementation is complete. The root `/` route now renders a public light-mode
Landing Page using the `Agent Skill Control Room` concept. `AppShell` allows `/`
without stored tokens while preserving auth checks for Console routes. The primary
visual is component-rendered and local to the repo, so no third-party hotlinked
media or generated asset provenance is required.

## Context and Orientation

### Current state

| Path | Why it matters |
|------|----------------|
| `frontend/src/app/layout.tsx` | Root provider composition; currently wraps all pages in `AppShell` |
| `frontend/src/components/app/app-shell.tsx` | Authenticated Console shell and auth redirect behavior |
| `frontend/src/app/page.tsx` | Existing root route that would conflict with a route-group Landing page |
| `frontend/src/app/globals.css` | Current token source and HSL/OKLCH mixing point |
| `frontend/tailwind.config.ts` | Tailwind semantic color and font mappings |
| `frontend/src/i18n/` | Required boundary for user-visible copy |
| `docs/design-docs/landing-page-light-mode.md` | Durable visual and information architecture decision |

### Related docs

- `docs/product-specs/2026-05-02-landing-page-light-mode.md`
- `docs/design-docs/landing-page-light-mode.md`
- `docs/exec-plans/completed/landing-page-light-mode-tasks.md`
- `docs/DESIGN.md`
- `frontend/AGENTS.md`

## Plan of Work

### Phase 1: Documentation and review

Create and validate the documentation set before code changes:

1. Correct the design doc.
2. Add the product spec.
3. Add this active ExecPlan.
4. Add the sibling task checklist.
5. Update design, product spec, and active plan indexes.
6. Run `python scripts/validate_agents_docs.py --level ERROR`.

### Phase 2: Shell and route boundary

After review, implement the smallest route/Shell change that makes a public Landing Page possible:

1. Done: `/` is the Landing Page; authenticated Console entry remains `/dashboard`.
2. Done: `AppShell` treats `/` as a public route without token checks.
3. Done: existing login, register, dashboard, and authenticated Console tests still pass.
4. Done: focused tests cover public route access and authenticated route protection.

### Phase 3: Landing UI and i18n

Build the light-mode Landing Page:

1. Done: Landing-specific components live under `frontend/src/components/landing/`.
2. Done: English and Chinese i18n copy was added.
3. Done: `LandingControlRoomPreview` is the primary visual.
4. Done: the preview includes Skill registry, version rail, and distribution map sections.
5. Not needed: component-rendered preview was sufficient, so no visual assets were added.
6. Done: semantic HSL tokens now match Tailwind's `hsl(var(--token))` mappings.
7. Done by implementation constraints and build validation; browser visual QA remains a recommended manual follow-up.

### Phase 4: Validation and documentation updates

Validate the completed implementation:

1. Run focused frontend tests.
2. Run frontend lint.
3. Run frontend build when route/layout behavior changes.
4. Run documentation validation.
5. Update this plan's Progress, Surprises & Discoveries, Decision Log, and validation notes.

## Concrete Steps

### Step 1: Validate docs-only phase

```bash
cd D:\Github\open-skillhub
python scripts/validate_agents_docs.py --level ERROR
```

Expected: 0 errors. Any warnings should be reviewed and either fixed or recorded.

### Step 2: Add route/Shell tests or focused assertions

Before code changes, identify the existing frontend test pattern for route-level behavior:

```bash
cd D:\Github\open-skillhub\frontend
npm test -- --run
```

Expected before new tests: current frontend test suite passes or the existing baseline failure is recorded.

### Step 3: Implement public route boundary

Modify the smallest set of files needed to make `/` public and keep authenticated Console behavior intact. Candidate files:

- `frontend/src/app/layout.tsx`
- `frontend/src/components/app/app-shell.tsx`
- `frontend/src/app/page.tsx`

Run the focused test from Step 2 after each meaningful change.

### Step 4: Implement Landing components and copy

Candidate files:

- `frontend/src/components/landing/*`
- `frontend/src/i18n/messages/en-US.ts`
- `frontend/src/i18n/messages/zh-CN.ts`
- `frontend/src/i18n/messages/types.ts`
- `frontend/public/landing/*`

Use the corrected design doc as the source of truth for copy, layout, token, motion, preview composition, and asset decisions.

### Step 5: Run frontend and docs gates

```bash
cd D:\Github\open-skillhub\frontend
npm run lint
npm test
npm run build
cd D:\Github\open-skillhub
python scripts/validate_agents_docs.py --level ERROR
```

Expected: all gates pass, or any skipped/failed broader gate is recorded in this plan and final handoff with residual risk.

Actual validation:

- `npm test -- --run src/__tests__/app-shell-auth.test.tsx` passed with 7 tests.
- `npm test -- --run src/__tests__/pages.test.tsx` passed with 25 tests.
- `npm run lint` passed with no warnings or errors.
- `npm test` passed with 12 test files and 62 tests after metadata title alignment.
- `npm run build` passed and generated the `/` route successfully.
- `python scripts/validate_agents_docs.py --level ERROR` passed with 0 errors and 0 warnings.
- Runtime smoke check passed: `http://127.0.0.1:3000/` returned HTTP 200 from the local Next.js dev server.

## Validation and Acceptance

Documentation-stage acceptance:

- `docs/design-docs/landing-page-light-mode.md` no longer includes inaccurate implementation claims, unverified marketing claims, external hotlinked media requirements, negative tracking, or route-group assumptions.
- Product spec, ExecPlan, task checklist, and indexes are present.
- `python scripts/validate_agents_docs.py --level ERROR` passes.

Implementation-stage acceptance:

- Unauthenticated users can access the public Landing Page.
- Authenticated Console routes still require valid session behavior.
- CTA routes point to existing login/register/public Skills destinations.
- All visible strings are localized.
- The primary visual implements the `Agent Skill Control Room` concept with Skill registry, version rail, and distribution map content.
- Visual assets are local or documented when assets are used.
- The page respects reduced motion and responsive text constraints.
- Frontend lint, tests, build, and docs validation pass or have explicit owner-accepted residual risk.
