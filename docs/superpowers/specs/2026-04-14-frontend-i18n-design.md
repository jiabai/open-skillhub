# Frontend I18n Design

## Goal

Introduce a dedicated frontend internationalization boundary for the Next.js console so locale resolution, dictionary loading, and translated UI copy stop being scattered across pages.

## Scope

This first batch covers:

- `frontend/src/app/layout.tsx`
- `frontend/src/lib/navigation.ts`
- `frontend/src/components/app/app-shell.tsx`
- `frontend/src/components/app/workspace-boundary-note.tsx`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/dashboard/page.tsx`

Out of scope for this batch:

- locale-prefixed routes such as `/en-US/...`
- a language switcher UI
- backend-side localized error payloads
- migrating every existing page in one pass

## Architecture

### Dedicated i18n module

Create `frontend/src/i18n/` as the single frontend entry point for:

- supported locale definitions
- locale normalization and request resolution
- dictionary loading
- React context and hooks for translated copy

### Server-selected locale, client-consumed dictionary

The root layout should resolve the locale from request inputs, then inject the chosen locale and dictionary into a client provider. This keeps language selection centralized while allowing client pages and components to consume translated copy through a simple hook.

### Domain-shaped dictionaries

Translation resources should be organized by UI domain within each locale dictionary, for example:

- metadata
- navigation
- app shell
- login
- dashboard

This keeps copy close to the feature boundary without reintroducing page-level hardcoded strings.

### Backend contract

Backend responses should continue returning stable codes and structured data. Frontend presentation text remains the responsibility of the console layer.

## Rollout Strategy

1. Add i18n infrastructure with a default locale and fallback behavior.
2. Migrate shared shell and navigation first so common chrome uses one translation source.
3. Migrate `login` and `dashboard` as the first feature pages.
4. Leave the remaining pages on the old model until they can be moved incrementally to the same pattern.

## Success Criteria

- No new hardcoded layout, shell, navigation, login, or dashboard copy is introduced outside the i18n module.
- `<html lang>` and metadata use the resolved locale instead of a fixed `zh-CN`.
- Shared navigation labels come from centralized dictionaries.
- The first migrated pages continue to pass targeted frontend tests.
