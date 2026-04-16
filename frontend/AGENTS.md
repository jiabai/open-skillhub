# AGENTS.md — Frontend

Guidance for AI coding agents working with the `frontend/` subproject. For project-wide context, see the root [AGENTS.md](../AGENTS.md).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), standalone output |
| Language | TypeScript 5.6 (strict mode, ES2022 target) |
| UI | React 18, shadcn/ui (radix-nova style), Radix UI primitives |
| Styling | Tailwind CSS 3.4 + tailwindcss-animate, CSS variables for theming |
| Icons | lucide-react |
| Notifications | sonner |
| Theming | next-themes (class-based dark mode) |
| Dates | date-fns 4.1 |
| i18n | Custom: cookie-based locale resolution, dictionary pattern |
| Testing | Vitest 2.1 + jsdom + @testing-library/react |
| Linting | ESLint 8 (next/core-web-vitals) |
| Package Manager | npm |

## Directory Structure

```
frontend/
  package.json          # skillhub-console v0.1.0, ESM module
  next.config.mjs       # standalone output, /api/* rewrite to backend
  tsconfig.json         # strict, @/* → src/*
  tailwind.config.ts    # dark mode "class", custom colors/screens/fonts
  vitest.config.ts      # jsdom, setupFiles, @ alias
  components.json       # shadcn/ui config (radix-nova style)
  Dockerfile            # Multi-stage: node:20-slim builder + runner
  .env.example          # NEXT_PUBLIC_API_BASE_URL only
  public/
    robots.txt
  src/
    app/                # Next.js App Router pages
      layout.tsx        #   Root layout: fonts, ThemeProvider, I18nProvider, RuntimeConfigProvider, AppShell, Toaster
      page.tsx          #   Home page (client component)
      globals.css       #   CSS variables for light/dark themes, tw-animate-css + shadcn imports
      dashboard/        #   Dashboard overview (no-rbac vs rbac modes)
      login/            #   Email OTP login, SSO redirect, LDAP sub-page
        ldap/           #     LDAP username/password login
        sso/callback/   #     SSO OIDC callback (extracts tokens from URL fragment)
      register/         #   Email OTP registration
      skills/           #   Skill list, create, detail
        new/            #     Upload new skill (ZIP)
        [skillUuid]/    #     Skill detail with tabs (files, versions, settings)
          _components/  #     versions-tab.tsx
      public-skills/    #   Public skill browsing (reference & clone actions)
      tokens/           #   API token management
      profile/          #   User profile editing
      security/         #   Password change, account deletion
      audit/            #   Audit log viewer (RBAC only)
      admin/users/      #   User management (admin only)
    components/
      theme-provider.tsx    # next-themes wrapper
      app/
        app-shell.tsx           # Main layout shell: auth guard, nav, header, mobile drawer
        runtime-config-provider.tsx  # Fetches /api/v1/runtime-config on mount
        language-toggle.tsx     # Locale switcher (zh-CN ↔ en-US via cookie)
        floating-language-toggle.tsx # Fixed-position language toggle for auth pages
        theme-toggle.tsx        # Light/dark mode toggle
        page-intro.tsx          # Reusable page header (title + summary + actions)
        next-step-card.tsx      # Call-to-action card with arrow link
        skill-type-explainer.tsx # Explains reference vs clone concepts
        workspace-boundary-note.tsx # Shows "personal workspace" or "governed console" badge
      ui/                    # shadcn/ui components (20 primitives)
    hooks/
      use-form-validation.ts   # useField hook + validation rule factories
      use-runtime-config.ts    # Convenience hook for RuntimeConfigContext
      use-toast.ts             # sonner wrapper (success/error/warning/info)
    i18n/
      config.ts                # Locale resolution (zh-CN default), cookie name
      date-fns.ts              # date-fns locale mapping
      format-message.ts        # Simple {key} template interpolation
      get-dictionary.ts        # Dictionary lookup by locale
      i18n-provider.tsx        # React context provider for locale + dictionary
      use-i18n.ts              # Convenience hook for I18nContext
      messages/
        types.ts               # AppDictionary type definition (14.2 KB)
        en-US.ts               # English translations (26.4 KB)
        zh-CN.ts               # Chinese translations (25.8 KB)
    lib/
      api.ts                   # API client: fetch wrapper, JWT auto-refresh, all endpoints
      runtime-config.ts        # Runtime config: fetch, snapshot, subscribe, test helpers
      navigation.ts            # Nav items builder (adapts to RBAC/audit flags)
      skill-download.ts        # Download error messages + artifact builder
      user-status.ts           # User status enum from shared/user-statuses.json
      utils.ts                 # cn() utility (clsx + tailwind-merge)
    types/
      index.ts                 # All TypeScript type definitions (API request/response types)
    test/
      setup.ts                 # Vitest setup: mocks @/lib/api, ResizeObserver, runtime config
      vitest.d.ts              # Global vitest type declarations
    __tests__/                 # 10 test files covering API, pages, hooks, i18n
```

## Development Commands

```bash
npm install                  # Install dependencies
npm run dev                  # Start dev server (http://localhost:3000)
npm run build                # Production build
npm run lint                 # ESLint check
npm test                     # Run Vitest tests
npm run test:watch           # Vitest watch mode
```

## Architecture

### Page Structure

All pages are under `src/app/` following Next.js App Router conventions. Most pages are **client components** (`"use client"`) because they depend on browser APIs (localStorage for auth, runtime config, etc.).

```
Root Layout (layout.tsx)
  └─ ThemeProvider (next-themes, class-based)
      └─ I18nProvider (locale + dictionary context)
          └─ RuntimeConfigProvider (fetches /api/v1/runtime-config)
              └─ AppShell (auth guard, navigation, header)
                  └─ Page Content
```

### API Client (`src/lib/api.ts`)

The API client is the central module for all backend communication:

- **Token storage**: JWT tokens stored in `localStorage` under key `skillhub.tokens`
- **Auto-refresh**: On 401 responses, automatically refreshes using `refresh_token` and retries the request
- **Concurrent refresh protection**: Uses a shared `refreshPromise` to prevent multiple simultaneous refresh requests
- **Base URL**: Resolved from `NEXT_PUBLIC_API_BASE_URL` env var (defaults to `http://localhost:8000`)
- **Error handling**: `ApiError` class with `status` and `code` fields; `getErrorMessage()` maps error codes to user-friendly Chinese messages

API methods are organized by domain: auth, users, dashboard, skills, skill versions, skill files, tokens, audit logs.

### Runtime Config (`src/lib/runtime-config.ts`)

Feature flags come from the backend endpoint `/api/v1/runtime-config`, not from frontend env vars. The `RuntimeConfigProvider` fetches this on mount and provides it via React context. Components access it via `useRuntimeConfig()` hook.

Key capabilities: `rbac`, `audit_log`, `sso`, `ldap`, `email_otp_login`, `public_signup`, `skill_visibility`, `public_skills`, `org_model`, `audit_export`, `no_rbac_mode`

### Internationalization (`src/i18n/`)

Custom i18n system without external libraries:

- **Supported locales**: `zh-CN` (default), `en-US`
- **Resolution order**: Cookie `skillhub.locale` → Accept-Language header → default
- **Dictionary pattern**: Full dictionaries loaded at build time (no dynamic loading)
- **Switching**: `LanguageToggle` sets cookie and calls `router.refresh()` to reload server components
- **Type safety**: `AppDictionary` type in `messages/types.ts` ensures all keys are typed

### Navigation (`src/lib/navigation.ts`)

Navigation items are computed dynamically based on runtime config:

- **No-RBAC mode**: workspace, public skills, my skills, tokens, profile, security
- **RBAC mode**: overview, skills, public skills, tokens, audit (if enabled), users (if admin), profile, security

### App Shell (`src/components/app/app-shell.tsx`)

`AppShell` handles:

- Auth guard: redirects unauthenticated users to `/login`, authenticated users away from auth pages
- Navigation rendering: desktop top nav + mobile sheet drawer
- User info display and logout with confirmation dialog
- Skip-to-main-content accessibility link

## Conventions

### Code Style

- **`"use client"` directive** required on all components that use hooks, browser APIs, or event handlers
- **Path alias**: `@/*` maps to `src/*` — always use `@/` imports, never relative paths across directories
- **TypeScript strict mode**: no implicit any, strict null checks
- **Component pattern**: default export for pages (`export default function PageName()`), named exports for reusable components
- **CSS**: use Tailwind utility classes; custom CSS variables defined in `globals.css` for theming
- **`cn()` utility** from `@/lib/utils` for conditional class merging (clsx + tailwind-merge)

### Component Organization

- `components/ui/` — shadcn/ui primitives (do not manually edit; use `npx shadcn@latest add` to add new ones)
- `components/app/` — application-specific components (AppShell, toggles, cards)
- Page components live directly in their route directory

### Data Fetching

- Pages fetch data in `useEffect` on mount
- All API calls go through `src/lib/api.ts` — never use raw `fetch` directly in components
- Runtime config fetched once by `RuntimeConfigProvider` and accessed via context

### Form Validation

- Use `useField` hook from `@/hooks/use-form-validation` for form fields
- Validation rules created via factory functions: `createEmailRules()`, `createUsernameRules()`, etc.
- Errors show on blur (not on type) for better UX

### Testing

- **Framework**: Vitest + jsdom + @testing-library/react
- **Setup**: `src/test/setup.ts` mocks the entire `@/lib/api` module with vi.fn() stubs
- **Runtime config in tests**: Use `__setRuntimeConfigForTests()` / `__resetRuntimeConfigForTests()` from `@/lib/runtime-config`
- **Test helpers**: `renderWithRuntimeConfig()` wraps components with `I18nProvider` + `RuntimeConfigContext.Provider`
- **Location**: Test files in `src/__tests__/`, named `{feature}.test.ts` or `{feature}.test.tsx`
- **API tests**: Use `vi.stubGlobal("fetch", mock)` + `vi.resetModules()` for unit-testing api.ts without the global mock

### Environment

- Single env var: `NEXT_PUBLIC_API_BASE_URL` (baked at build time for Docker)
- In development, Next.js rewrites `/api/*` to `API_INTERNAL_URL` (default `http://api:8001`)
- All feature flags come from backend at runtime, not from frontend env

## Common Tasks

### Adding a new page

1. Create directory under `src/app/` with `page.tsx`
2. Add `"use client"` directive if the page uses hooks or browser APIs
3. Import and use `useRuntimeConfig()` for feature flag checks
4. Import and use `useI18n()` for all user-facing text (never hardcode strings)
5. Add navigation entry in `src/lib/navigation.ts` if needed
6. Add i18n keys to `src/i18n/messages/en-US.ts`, `zh-CN.ts`, and `types.ts`
7. Add types for any new API responses in `src/types/index.ts`
8. Add API method in `src/lib/api.ts` if calling new backend endpoints
9. Mock new API methods in `src/test/setup.ts`
10. Add page test in `src/__tests__/`

### Adding a new shadcn/ui component

```bash
npx shadcn@latest add <component-name>
```

This updates `components.json` and creates the file in `src/components/ui/`. Do not manually create UI primitives.

### Adding a new i18n key

1. Add the key to `AppDictionary` type in `src/i18n/messages/types.ts`
2. Add the translation in `src/i18n/messages/zh-CN.ts`
3. Add the translation in `src/i18n/messages/en-US.ts`
4. Access via `dictionary.section.key` from `useI18n()` hook

### Modifying the theme

- CSS variables are in `src/app/globals.css` (light mode in `:root`, dark mode in `.dark`)
- Custom colors, screens, and fonts in `tailwind.config.ts`
- Theme switching handled by `next-themes` via `ThemeProvider`

## Important Notes

- Never hardcode user-facing text — always use `useI18n()` dictionary
- `NEXT_PUBLIC_API_BASE_URL` is baked at build time; changing it requires a Docker rebuild
- The `shared/` directory (e.g., `user-statuses.json`) is copied during Docker build and imported directly
- API mock in `src/test/setup.ts` is comprehensive — add new method stubs when adding API endpoints
- The app has two UI modes: "personal workspace" (no RBAC) and "governed console" (RBAC enabled) — test both
- SSO callback page extracts tokens from URL hash fragment (`#access_token=...&refresh_token=...`)
- Skill detail page uses `_components/` subdirectory for the versions tab (co-located component)
