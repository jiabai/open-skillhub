# Desktop Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Add a one-click persisted light/dark theme toggle to the SkillDrive
desktop client, visually aligned with the frontend console dark mode.

**Architecture:** Extend the desktop runtime configuration with an `AppTheme`,
save it through typed IPC, apply `.dark` to the renderer document root, and map
frontend semantic dark tokens into desktop `--osh-*` CSS variables.

**Tech Stack:** Electron main/preload IPC, React renderer, TypeScript, local CSS
tokens, Vitest, Vite.

---

## Scope

- Persist explicit `light` or `dark` theme in desktop JSON config.
- Default missing theme to `dark`.
- Add theme save IPC and preload bridge method.
- Add a one-click theme toggle to the desktop header action row.
- Align dark palette with frontend console semantic tokens.
- Add tests for config persistence, bridge coverage, UI toggle behavior, and
  failure restoration.
- Update durable docs after implementation.

## Non-Goals

- No backend changes.
- No OS system theme syncing.
- No Tailwind, shadcn, or `next-themes` in desktop.
- No unrelated visual redesign.

## Progress

- [x] 2026-05-02: Reviewed root workflow, execution gates, desktop guidance,
  desktop design/architecture, current desktop runtime config, current desktop
  renderer shell, and frontend theme implementation.
- [x] 2026-05-02: Added English and Chinese product specs.
- [x] 2026-05-02: Added technical design.
- [ ] Implementation not started; waiting for review gate approval.

## Decisions

- Use a two-state `AppTheme = "light" | "dark"` model.
- Default desktop theme to dark to match frontend.
- Persist theme in `config/config.json`; it is not secret.
- Add `saveTheme(theme)` IPC instead of piggybacking on `saveLocale`.
- Apply the theme through `.dark` on `document.documentElement`.
- Keep desktop CSS token based; do not import frontend CSS or dependencies.
- Add `lucide-react` to desktop only if implementation chooses icon parity with
  frontend `Sun` and `MoonStar`.

## File Map

Create:

| File | Responsibility |
|------|----------------|
| `src/components/theme-toggle.tsx` | Header theme toggle UI, icon/button state, accessible labels |

Modify:

| File | Change |
|------|--------|
| `package.json` | Add `lucide-react` if icon parity is implemented |
| `package-lock.json` | Lock dependency update if `lucide-react` is added |
| `src/types/index.ts` | Add `AppTheme`; add `theme` to `ConfigurationState` |
| `src/core/runtime/runtime-config-manager.ts` | Resolve, persist, and save theme |
| `electron/ipc.ts` | Add `configuration:save-theme` channel and handler contract |
| `electron/preload.ts` | Expose `saveTheme` bridge method |
| `electron/main.ts` | Wire `saveTheme` handler and `toConfigurationState` theme field |
| `src/lib/ipc-client.ts` | Add typed `saveTheme` wrapper |
| `src/app/App.tsx` | Own selected theme, apply `.dark`, handle toggle persistence/failure |
| `src/components/app-shell.tsx` | Render theme toggle in header action row |
| `src/i18n/messages/types.ts` | Add theme toggle copy contract |
| `src/i18n/messages/en-US.ts` | Add English theme toggle copy |
| `src/i18n/messages/zh-CN.ts` | Add Chinese theme toggle copy |
| `src/styles.css` | Add dark token block and replace hardcoded light surfaces |
| `src/__tests__/app.test.tsx` | Cover bridge, initial class, toggle save, failure restore |
| `src/__tests__/storage.test.ts` | Cover theme default, persistence, preservation, invalid fallback |
| `docs/ARCHITECTURE.md` | Record theme config and renderer class behavior |
| `docs/DESIGN.md` | Record light/dark visual alignment rule |
| `docs/references/runtime-and-storage-surface.md` | Record config field and IPC channel |
| `task-tracker.md` | Move work to Done after validation |
| `docs/exec-plans/active/index.md` | Remove plan after completion |
| `docs/exec-plans/completed/index.md` | Add completed plan after completion |

## Implementation Tasks

### Task 1: Runtime Theme Contract

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/core/runtime/runtime-config-manager.ts`
- Test: `src/__tests__/storage.test.ts`

- [ ] Write failing tests for default dark theme, `saveTheme("light")`, invalid
  stored value fallback, and theme preservation across configuration save,
  locale save, and clear.
- [ ] Run focused storage tests and confirm they fail.
- [ ] Add `AppTheme`, config state fields, `resolveTheme`, and `saveTheme`.
- [ ] Run focused storage tests and confirm they pass.

### Task 2: IPC And Bridge

**Files:**
- Modify: `electron/ipc.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts`
- Modify: `src/lib/ipc-client.ts`
- Test: `src/__tests__/app.test.tsx`

- [ ] Write failing tests that the desktop bridge exposes and proxies
  `saveTheme`.
- [ ] Run focused app bridge tests and confirm they fail.
- [ ] Add IPC channel, interfaces, preload method, main handler, and renderer
  wrapper.
- [ ] Run focused app bridge tests and confirm they pass.

### Task 3: Renderer Theme State And Toggle

**Files:**
- Create: `src/components/theme-toggle.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/i18n/messages/types.ts`
- Modify: `src/i18n/messages/en-US.ts`
- Modify: `src/i18n/messages/zh-CN.ts`
- Test: `src/__tests__/app.test.tsx`

- [ ] Write failing tests for initial `.dark` class, toggle from dark to light,
  returned state reconciliation, and failed save restoration.
- [ ] Run focused app tests and confirm they fail.
- [ ] Implement theme state, document class effect, i18n copy, and header toggle.
- [ ] Run focused app tests and confirm they pass.

### Task 4: Dark CSS Token Coverage

**Files:**
- Modify: `src/styles.css`
- Test: `src/__tests__/app.test.tsx` when assertions are useful

- [ ] Add `:root.dark` token block using frontend-aligned semantic values.
- [ ] Replace or override hardcoded light surfaces with tokens.
- [ ] Inspect CSS for remaining light-only colors that affect visible surfaces.
- [ ] Run focused app tests.

### Task 5: Documentation And Validation

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DESIGN.md`
- Modify: `docs/references/runtime-and-storage-surface.md`
- Modify: `task-tracker.md`
- Move after completion: active plan and checklist to `docs/exec-plans/completed/`

- [ ] Update durable docs with implemented theme persistence, IPC, and CSS
  behavior.
- [ ] Run `cd desktop-client && npm test`.
- [ ] Run `cd desktop-client && npm run build`.
- [ ] Run `python scripts/validate_agents_docs.py --level ERROR`.
- [ ] Run `git diff --check`.
- [ ] Archive the active ExecPlan and task checklist after implementation
  validation.

## Validation Plan

Required:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Manual visual QA after implementation:

- Launch with `cd desktop-client && npm run start:electron`.
- Verify dark default on first run or unset theme.
- Toggle to light, restart, verify light persists.
- Toggle back to dark, verify Home, Local Skills, Updates, Settings drawer,
  config panel, activity list, dialogs, callouts, badges, and focus rings.

## Validation Results

Pending implementation.

## Outcome

Pending implementation.
