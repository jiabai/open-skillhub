# Frontend Mode-Adaptive UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the frontend so `ENABLE_RBAC=false` behaves like a personal Skill workspace and `ENABLE_RBAC=true` behaves like a governance-oriented console, with mode-aware navigation, dashboard, and key task flows.

**Architecture:** Keep the existing Next.js route structure, add a first-class frontend `appMode`, and refactor shared pages to render mode-specific IA, copy, and action priority. Build the redesign from the shell and configuration layer downward so later page work has a stable mode source and shared explanatory UI.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, shadcn/ui, Tailwind CSS, Vitest

---

## File Map

### Existing files to modify

- `frontend/src/lib/feature-flags.ts`
  - Current frontend runtime flags; extend or complement for explicit mode handling.
- `frontend/src/components/app/app-shell.tsx`
  - Main navigation shell; convert to mode-aware navigation.
- `frontend/src/app/dashboard/page.tsx`
  - Replace generic dashboard emphasis with mode-specific home experience.
- `frontend/src/app/skills/page.tsx`
  - Reframe as `My Skills` in `no-rbac` and scoped `Skills` in `rbac`.
- `frontend/src/app/public-skills/page.tsx`
  - Add onboarding framing, action guidance, and success next steps.
- `frontend/src/app/skills/[skillUuid]/page.tsx`
  - Make type, effective version, and action restrictions explicit.
- `frontend/src/app/skills/[skillUuid]/_components/versions-tab.tsx`
  - Improve pin/follow-latest/download/rollback explanation and status messaging.
- `frontend/src/app/tokens/page.tsx`
  - Convert from plain token list to create-and-connect workflow.
- `frontend/src/__tests__/pages.test.tsx`
  - Extend coverage for mode-specific page rendering.
- `frontend/src/__tests__/app-shell-auth.test.tsx`
  - Extend navigation coverage for mode-specific shell behavior.

### New files to create

- `frontend/src/lib/app-mode.ts`
  - Single source of truth for `AppMode` and related helpers.
- `frontend/src/lib/navigation.ts`
  - Mode-aware navigation definitions.
- `frontend/src/components/app/page-intro.tsx`
  - Reusable page intro with title, summary, and optional boundary note.
- `frontend/src/components/app/mode-boundary-note.tsx`
  - Reusable explainer block for no-RBAC vs RBAC page framing.
- `frontend/src/components/app/next-step-card.tsx`
  - Reusable success and onboarding next-step UI.
- `frontend/src/components/app/skill-type-explainer.tsx`
  - Reusable explanation block for `reference`, `clone`, and `download`.
- `frontend/src/__tests__/app-mode.test.ts`
  - Unit tests for mode resolution helpers.

## Dependency Order

1. Add explicit app mode model.
2. Make navigation depend on app mode.
3. Add shared explanatory UI blocks.
4. Refactor dashboard to establish mode-specific product entry.
5. Refactor `public-skills`, then `skills`, then skill detail/version UX.
6. Refactor `tokens` after task-chain context exists.
7. Expand tests to lock behavior.

---

### Task 1: Add Explicit Frontend App Mode

**Files:**
- Create: `frontend/src/lib/app-mode.ts`
- Modify: `frontend/src/lib/feature-flags.ts`
- Test: `frontend/src/__tests__/app-mode.test.ts`

- [x] **Step 1: Write the failing test for app mode resolution**

Create `frontend/src/__tests__/app-mode.test.ts` with cases for:
- `NEXT_PUBLIC_ENABLE_RBAC=true` -> `rbac`
- `NEXT_PUBLIC_ENABLE_RBAC=false` or unset -> `no-rbac`
- helper booleans such as `isNoRbacMode` and `isRbacMode`

Expected result: test file exists and imports fail because `app-mode.ts` does not exist yet.

- [x] **Step 2: Run the test to verify it fails**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/app-mode.test.ts
```

Expected: FAIL due to missing module or missing exports.

- [x] **Step 3: Implement the minimal app mode helper**

Create `frontend/src/lib/app-mode.ts` with:
- `type AppMode = "no-rbac" | "rbac"`
- one resolver reading `NEXT_PUBLIC_ENABLE_RBAC`
- exported helpers for `isNoRbacMode` and `isRbacMode`

Modify `frontend/src/lib/feature-flags.ts` only enough to expose or align with the new explicit mode source without duplicating logic.

- [x] **Step 4: Run the test to verify it passes**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/app-mode.test.ts
```

Expected: PASS.

- [x] **Step 5: Verify result**

Check that:
- there is exactly one frontend runtime mode source
- `feature-flags.ts` no longer forces pages to infer RBAC mode indirectly

Verifiable result: `frontend/src/lib/app-mode.ts` exists and tests pass.

---

### Task 2: Make Navigation Mode-Aware

**Files:**
- Create: `frontend/src/lib/navigation.ts`
- Modify: `frontend/src/components/app/app-shell.tsx`
- Test: `frontend/src/__tests__/app-shell-auth.test.tsx`

- [x] **Step 1: Write the failing shell test**

Extend `frontend/src/__tests__/app-shell-auth.test.tsx` with assertions that:
- `no-rbac` mode shows `Public Skills`, `My Skills`, `Tokens`
- `no-rbac` mode does not render `Audit` or `Users` as primary nav items
- `rbac` mode can render `Skills`, `Audit`, and `Users` when permissions allow

Expected result: tests fail because the shell still uses the current static nav construction.

- [x] **Step 2: Run the test to verify it fails**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/app-shell-auth.test.tsx
```

Expected: FAIL on new navigation assertions.

- [x] **Step 3: Extract navigation config**

Create `frontend/src/lib/navigation.ts` with mode-aware nav definitions.

Modify `frontend/src/components/app/app-shell.tsx` to:
- read `appMode`
- render mode-specific labels and nav entries
- preserve permission-based gating for RBAC-only management destinations
- rename `Skills` to `My Skills` in `no-rbac`

- [x] **Step 4: Run the test to verify it passes**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/app-shell-auth.test.tsx
```

Expected: PASS.

- [x] **Step 5: Verify result**

Check visually in code that navigation logic now comes from one place and is ordered by mode.

Verifiable result: shell nav is mode-aware and tested.

---

### Task 3: Create Shared Explanatory UI Components

**Files:**
- Create: `frontend/src/components/app/page-intro.tsx`
- Create: `frontend/src/components/app/mode-boundary-note.tsx`
- Create: `frontend/src/components/app/next-step-card.tsx`
- Create: `frontend/src/components/app/skill-type-explainer.tsx`

- [x] **Step 1: Define component interfaces**

Create small typed props for each component so page code can compose:
- title + summary + note
- mode boundary message
- success next step link + summary
- `reference` / `clone` / `download` explainer content

Expected result: components compile independently and expose minimal props.

- [x] **Step 2: Implement minimal presentational versions**

Add the components using existing shadcn cards/badges/text patterns. Do not introduce new state or business logic yet.

- [x] **Step 3: Verify compile health**

Run:

```powershell
cd frontend
npm run build
```

Expected: build succeeds with the new shared components.

- [x] **Step 4: Verify result**

Check that each component has:
- a single responsibility
- no page-specific API coupling
- copy slots that can vary by mode

Verifiable result: shared UX building blocks exist and build passes.

---

### Task 4: Refactor Dashboard into Mode-Specific Home

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`
- Test: `frontend/src/__tests__/pages.test.tsx`

- [x] **Step 1: Write the failing dashboard tests**

Extend `frontend/src/__tests__/pages.test.tsx` with assertions that:
- `no-rbac` dashboard shows task-oriented sections like `Start Here`
- `no-rbac` dashboard emphasizes public Skill browsing, upload, and token creation
- `rbac` dashboard shows governance-oriented sections

Expected result: new tests fail because dashboard is still generic.

- [x] **Step 2: Run the test to verify it fails**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/pages.test.tsx
```

Expected: FAIL on dashboard assertions.

- [x] **Step 3: Implement no-RBAC dashboard structure**

Modify `frontend/src/app/dashboard/page.tsx` to render in `no-rbac`:
- `Start Here`
- `My Workspace Snapshot`
- `Need To Know`

Use the shared intro and next-step components where appropriate.

- [x] **Step 4: Implement RBAC dashboard framing**

In the same page, render RBAC-specific section headings and summaries:
- `Team / Org Overview`
- `Skill Governance`
- `Audit & Access`
- `Pending Actions`

Keep existing metrics fetches where still useful.

- [x] **Step 5: Run the test to verify it passes**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/pages.test.tsx
```

Expected: PASS for dashboard-specific assertions.

- [x] **Step 6: Verify result**

Check that the first screen now answers different questions by mode instead of reusing a single admin-console mental model.

Verifiable result: dashboard is mode-specific and tested.

---

### Task 5: Redesign Public Skills as a Primary No-RBAC Entry

**Files:**
- Modify: `frontend/src/app/public-skills/page.tsx`
- Test: `frontend/src/__tests__/pages.test.tsx`

- [x] **Step 1: Write the failing page tests**

Add assertions that `Public Skills` in `no-rbac`:
- shows a `reference / clone / download` explainer
- labels or emphasizes a recommended action
- shows a next-step message after reference or clone success

Expected result: FAIL because none of those UX elements exist yet.

- [x] **Step 2: Run the test to verify it fails**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/pages.test.tsx
```

Expected: FAIL on public-skills assertions.

- [x] **Step 3: Add the top explainer and task framing**

Modify `frontend/src/app/public-skills/page.tsx` to:
- use `page-intro`
- show `skill-type-explainer`
- frame the page as a starting point in `no-rbac`

- [x] **Step 4: Add action guidance and success next steps**

After successful `reference` or `clone`:
- show inline or card-based next steps
- link to `My Skills` or the newly created Skill detail page

Keep the current API interactions intact.

- [x] **Step 5: Improve download restriction messaging**

Use existing download error helpers, but make the page-level message explain the behavior in no-RBAC mode.

- [x] **Step 6: Run the test to verify it passes**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/pages.test.tsx
```

Expected: PASS for public-skills assertions.

- [x] **Step 7: Verify result**

Check that a first-time user can infer:
- what each action means
- which action to choose first
- where to go next after success

Verifiable result: `Public Skills` works as onboarding surface in `no-rbac`.

---

### Task 6: Reframe Skills Page as Personal Workspace vs Scoped Skills

**Files:**
- Modify: `frontend/src/app/skills/page.tsx`
- Test: `frontend/src/__tests__/pages.test.tsx`

- [x] **Step 1: Write the failing page tests**

Add assertions that:
- `no-rbac` page header explains this is the user's own workspace
- empty state offers `Public Skills` and upload entry actions
- skill cards distinguish `private`, `reference`, and `clone` more clearly

Expected result: FAIL because the page still uses generic list framing.

- [x] **Step 2: Run the test to verify it fails**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/pages.test.tsx
```

Expected: FAIL on skills-page assertions.

- [x] **Step 3: Update page framing**

Modify `frontend/src/app/skills/page.tsx` to:
- use `My Skills` copy in `no-rbac`
- explain the page boundary
- preserve `Skills` copy in `rbac`

- [x] **Step 4: Improve empty and card states**

Add:
- action-oriented empty state buttons
- stronger visual differentiation for `private`, `reference`, `clone`
- concise contextual text for reference follow/pin state

- [x] **Step 5: Run the test to verify it passes**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/pages.test.tsx
```

Expected: PASS for skills-page assertions.

- [x] **Step 6: Verify result**

Check that the page now clearly communicates ownership and workspace scope.

Verifiable result: `skills` page is mode-aware and task-oriented.

---

### Task 7: Make Skill Detail Explain Type, Effective Version, and Restrictions

**Files:**
- Modify: `frontend/src/app/skills/[skillUuid]/page.tsx`
- Modify: `frontend/src/app/skills/[skillUuid]/_components/versions-tab.tsx`
- Test: `frontend/src/__tests__/pages.test.tsx`

- [x] **Step 1: Write the failing detail-page tests**

Add assertions for:
- explicit Skill type labeling
- explicit `following latest` vs `pinned` messaging for references
- visible explanation for disabled reference-only actions
- version tab actions including clearer pin/follow-latest wording

Expected result: FAIL because the current page mostly exposes raw state.

- [x] **Step 2: Run the test to verify it fails**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/pages.test.tsx
```

Expected: FAIL on skill detail assertions.

- [x] **Step 3: Refactor overview and settings sections**

Modify `frontend/src/app/skills/[skillUuid]/page.tsx` to:
- surface skill type as a first-class summary
- add reason text for disabled actions
- make file list clearly refer to the current effective version

- [x] **Step 4: Refactor versions tab messaging**

Modify `frontend/src/app/skills/[skillUuid]/_components/versions-tab.tsx` to:
- explain pin/unpin behavior in action text
- explain download and rollback semantics
- make reference version state human-readable

- [x] **Step 5: Run the test to verify it passes**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/pages.test.tsx
```

Expected: PASS for detail-page assertions.

- [x] **Step 6: Verify result**

Check that a user can answer:
- what kind of Skill this is
- which version is actually in effect
- why some actions are unavailable

Verifiable result: skill detail becomes explanatory, not just descriptive.

---

### Task 8: Convert Tokens Page into Create-and-Connect Workflow

**Files:**
- Modify: `frontend/src/app/tokens/page.tsx`
- Test: `frontend/src/__tests__/pages.test.tsx`

- [x] **Step 1: Write the failing tokens-page tests**

Add assertions that:
- the page includes a `connect client` or equivalent next-step section
- after token creation, the UI shows what to do next
- empty state explains why a token matters for client access

Expected result: FAIL because the page currently focuses on creation and listing only.

- [x] **Step 2: Run the test to verify it fails**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/pages.test.tsx
```

Expected: FAIL on tokens-page assertions.

- [x] **Step 3: Refactor page structure**

Modify `frontend/src/app/tokens/page.tsx` to:
- keep token creation
- add a separate connect/access explanation section
- add a stronger post-create next step block

- [x] **Step 4: Improve empty and success states**

Add:
- no-token explanation tied to client usage
- clearer one-time visibility warning
- immediate next action after creation

- [x] **Step 5: Run the test to verify it passes**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/pages.test.tsx
```

Expected: PASS for tokens-page assertions.

- [x] **Step 6: Verify result**

Check that the page now completes the no-RBAC task chain rather than ending at credential creation.

Verifiable result: `tokens` page is action-complete and mode-consistent.

---

### Task 9: Lock in Cross-Page Copy and Boundary Consistency

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`
- Modify: `frontend/src/app/public-skills/page.tsx`
- Modify: `frontend/src/app/skills/page.tsx`
- Modify: `frontend/src/app/skills/[skillUuid]/page.tsx`
- Modify: `frontend/src/app/tokens/page.tsx`
- Test: `frontend/src/__tests__/pages.test.tsx`

- [x] **Step 1: Audit page copy for consistency**

Check each key page for these exact concepts:
- personal workspace in `no-rbac`
- governed/scoped management in `rbac`
- `reference` vs `clone`
- next step after success

Expected result: list of inconsistent labels or leftover generic wording.

- [x] **Step 2: Remove contradictory wording**

Update page headings and descriptions so:
- `no-rbac` never sounds like an admin console
- `rbac` never sounds like a purely personal tool

- [x] **Step 3: Run page test suite**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/pages.test.tsx src/__tests__/app-shell-auth.test.tsx src/__tests__/app-mode.test.ts
```

Expected: PASS.

- [x] **Step 4: Verify result**

Check that the task chain reads coherently across pages:

`Workspace -> Public Skills -> My Skills -> Tokens`

Verifiable result: no contradictory mode framing remains in key user-facing pages.

---

### Task 10: Run Final Frontend Verification

**Files:**
- Modify: none expected unless fixes are needed
- Test: `frontend/src/__tests__/pages.test.tsx`
- Test: `frontend/src/__tests__/app-shell-auth.test.tsx`
- Test: `frontend/src/__tests__/app-mode.test.ts`

- [x] **Step 1: Run targeted tests**

Run:

```powershell
cd frontend
npm test -- --run src/__tests__/app-mode.test.ts src/__tests__/app-shell-auth.test.tsx src/__tests__/pages.test.tsx
```

Expected: PASS.

- [x] **Step 2: Run production build**

Run:

```powershell
cd frontend
npm run build
```

Expected: successful build with no new type or route errors.

- [ ] **Step 3: Manual verification checklist**

Verify manually:
- `no-rbac` nav excludes primary `Audit` and `Users`
- `rbac` nav includes governance surfaces where allowed
- dashboard changes shape by mode
- `Public Skills` explains action choices
- `My Skills` explains ownership boundary
- skill detail explains type and version behavior
- tokens page tells user how to proceed after creation

- [ ] **Step 4: Commit**

Run:

```powershell
git add frontend/src/lib/app-mode.ts frontend/src/lib/navigation.ts frontend/src/components/app frontend/src/app/dashboard/page.tsx frontend/src/app/public-skills/page.tsx frontend/src/app/skills/page.tsx frontend/src/app/skills/[skillUuid]/page.tsx frontend/src/app/skills/[skillUuid]/_components/versions-tab.tsx frontend/src/app/tokens/page.tsx frontend/src/__tests__/app-mode.test.ts frontend/src/__tests__/app-shell-auth.test.tsx frontend/src/__tests__/pages.test.tsx
git commit -m "feat: add mode-adaptive frontend UX"
```

Expected: commit succeeds after tests and build pass.

- [ ] **Step 5: Verify result**

Confirm that the implementation satisfies the spec in `docs/superpowers/specs/2026-04-10-frontend-mode-adaptive-ux-design.md`.

Verifiable result: all planned UX changes are implemented, tested, and build successfully.
