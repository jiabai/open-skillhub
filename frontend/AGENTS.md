# Frontend AGENTS.md

Use this file when you are changing the Next.js web console. Read the root `AGENTS.md` first for project-wide guidance.

## Quick Entry

- Architecture map: `ARCHITECTURE.md`
- Design guidance: `docs/DESIGN.md`
- Product specs: `docs/product-specs/index.md`
- Active plans: `docs/exec-plans/active/index.md`

## Frontend Map

| Area | Path | Purpose |
|------|------|---------|
| Routes | `frontend/src/app/` | Next.js App Router pages and layouts |
| Shared app UI | `frontend/src/components/app/` | Shell, headers, toggles, reusable app-level building blocks |
| UI primitives | `frontend/src/components/ui/` | shadcn/ui components |
| Hooks | `frontend/src/hooks/` | Form validation, runtime config, toast helpers |
| Localization | `frontend/src/i18n/` | Locale resolution, dictionaries, providers, hooks |
| Client runtime | `frontend/src/lib/` | API client, runtime config store, navigation, utilities |
| Types | `frontend/src/types/` | Shared API and UI TypeScript types |
| Tests | `frontend/src/__tests__/`, `frontend/src/test/` | Vitest suites, mocks, and helpers |

## Boundary Rules

- All backend calls go through `frontend/src/lib/api.ts`.
- UI capability checks should come from the runtime config provider, not hardcoded env flags.
- User-facing copy should come from the i18n dictionary, not inline strings.
- Reusable app-specific components belong in `components/app/`; do not hand-roll new primitives inside `components/ui/`.
- Use the `@/` import alias across feature boundaries.

## Common Tasks

### Add a page

1. Create a route under `frontend/src/app/`.
2. Use `useRuntimeConfig()` when capability gating is needed.
3. Use `useI18n()` for user-facing strings.
4. Add or extend API methods in `frontend/src/lib/api.ts` if backend access is required.
5. Add types in `frontend/src/types/`.
6. Add or update tests in `frontend/src/__tests__/`.

### Add UI work

1. Reuse existing app components where possible.
2. Keep visual behavior aligned with the existing console style.
3. Prefer focused Tailwind utility changes over new global CSS.

## Validation

```bash
cd frontend && npm run lint
cd frontend && npm test
cd frontend && npm run build
```

## Notes

- The frontend is a consumer of backend contracts, especially runtime capabilities and auth flows.
- `layout.tsx` is the main provider composition point.
- `frontend/src/test/setup.ts` is the central test mock layer for API calls.
