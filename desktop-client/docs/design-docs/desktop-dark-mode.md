# Desktop Dark Mode - Technical Design

## Status

Planned. Implementation must wait for review of the product spec and ExecPlan.

## Context

The frontend console already supports dark mode through `next-themes` with
`attribute="class"` and `defaultTheme="dark"`. Its `ThemeToggle` is a compact
one-click button in the app shell header and flips between `dark` and `light`.

The desktop client has a separate renderer stack. It uses plain CSS tokens in
`src/styles.css`, local UI primitives, Electron IPC, and runtime config stored
through `src/core/runtime/runtime-config-manager.ts`. It must align with the
frontend behavior without importing frontend-only dependencies such as Tailwind,
shadcn, or `next-themes`.

## Design Decisions

- Use a two-state `AppTheme = "light" | "dark"` model.
- Default theme is `dark` for new or missing config, matching frontend.
- Persist theme in the existing desktop JSON config.
- Expose the current theme through `ConfigurationState`.
- Save theme through a dedicated typed IPC method, mirroring `saveLocale`.
- Apply the theme by toggling `.dark` on `document.documentElement`.
- Keep light mode as the current `:root` token set.
- Add dark tokens under `:root.dark` in `src/styles.css`.
- Use semantic desktop tokens (`--osh-*`) instead of copying Tailwind classes.
- Add `lucide-react` to the desktop package only for the theme toggle icons so
  the toggle matches frontend's `Sun` and `MoonStar` pattern.

## Frontend Token Translation

Frontend source values:

```css
.dark {
  --background: 222 22% 10%;
  --foreground: 36 30% 94%;
  --card: 222 22% 12%;
  --muted: 222 16% 20%;
  --muted-foreground: 30 12% 70%;
  --primary: 36 75% 65%;
  --accent: 188 65% 52%;
  --border: 222 16% 22%;
}
```

Desktop should map these into hex or HSL-compatible `--osh-*` values:

| Desktop Token | Dark Intent |
|---------------|-------------|
| `--osh-background` | page background, near frontend `--background` |
| `--osh-background-soft` | drawer/input/secondary surfaces |
| `--osh-foreground` | primary readable text |
| `--osh-muted` | secondary text |
| `--osh-muted-soft` | muted chips and secondary buttons |
| `--osh-card` | card surface |
| `--osh-card-strong` | dialog/high-emphasis surface |
| `--osh-primary` | primary actions, warm light foreground-like tone |
| `--osh-primary-foreground` | text on primary actions |
| `--osh-accent` | teal accent state |
| `--osh-border` | subtle dark border |
| `--osh-shadow` | lower-alpha dark shadow |

The dark palette should avoid leaving light cream literals in component CSS.
Existing hardcoded values such as `rgba(255, 253, 248, ...)`, `#fdfbf6`, and
`rgba(222, 214, 200, ...)` need tokenized replacements or dark overrides.

## Type Contract

Add to `src/types/index.ts`:

```typescript
export type AppTheme = "light" | "dark"

export interface ConfigurationState {
  theme: AppTheme
}
```

`DesktopRuntimeConfig` and `DesktopLocalConfig` should also carry `theme`.

## Runtime Config Changes

Update `src/core/runtime/runtime-config-manager.ts`:

- add `DEFAULT_APP_THEME = "dark"`
- add `resolveTheme(value: unknown): AppTheme`
- include `theme` in default JSON config
- read theme from local config
- preserve theme in:
  - `saveConfiguration`
  - `saveLocale`
  - `clearConfiguration`
- add `saveTheme(theme: AppTheme): Promise<RuntimeConfigurationState>`

The desktop runtime should not treat theme as secret and should not place it in
the keytar secret store.

## IPC Contract

Add one IPC channel:

```typescript
saveTheme: "configuration:save-theme"
```

Extend bridge and handler contracts:

```typescript
saveTheme(theme: AppTheme): Promise<ConfigurationState>
```

Validation rules:

- Accept only `"light"` or `"dark"`.
- Reject or normalize unknown values to the default in runtime config helpers.
- Return the full redacted `ConfigurationState`, consistent with `saveLocale`.

## Renderer Flow

`App.tsx` should own the active theme beside locale:

```typescript
const [selectedTheme, setSelectedTheme] = useState<AppTheme>("dark")
```

When configuration loads:

- set selected theme from `ConfigurationState.theme`
- apply the class to `document.documentElement`

When the user toggles:

1. determine next theme
2. optimistically set state and `.dark` class
3. call `desktopClient.saveTheme(nextTheme)`
4. reconcile with returned `ConfigurationState.theme`
5. on failure, restore previous theme and add activity/error feedback

Renderer-only bridge-unavailable behavior should remain clear. The toggle may
still flip local state during tests, but persistence errors must be surfaced
through existing activity/error patterns.

## UI Component

Create `src/components/theme-toggle.tsx` or keep it small inside `AppShell` if
the component stays focused.

Recommended component:

```typescript
type ThemeToggleProps = {
  theme: AppTheme
  disabled?: boolean
  onToggle: () => void
}
```

Use the existing `Button` primitive with `variant="outline"` and `size="sm"` or
an added icon-size variant. If `lucide-react` is added, use:

- `Sun` when current theme is dark
- `MoonStar` when current theme is light

Copy should come from i18n:

```typescript
themeToggle: {
  switchTheme: string
  switchToDark: string
  switchToLight: string
}
```

## CSS Strategy

Keep current light mode at `:root`.

Add:

```css
:root.dark {
  color-scheme: dark;
  --osh-background: ...;
  --osh-card: ...;
}
```

Then replace hardcoded light surfaces with tokens where needed:

- `body` gradient second stop
- `.app-header` border/background
- `.btn--outline`
- `.card`
- drawer/dialog surfaces
- callouts
- badges
- inputs
- update rows

Do not scale fonts or alter layout dimensions during theme toggles. The toggle
must not cause header layout shift.

## Tests

Add or extend tests in `src/__tests__/app.test.tsx`:

- desktop API surface exposes `saveTheme`
- renderer wrapper proxies `saveTheme`
- app loads initial theme from configuration and applies `.dark`
- clicking theme toggle calls `saveTheme("light")` from dark mode
- returned theme updates button state
- failed save restores prior theme and surfaces activity feedback

Add or extend tests in `src/__tests__/storage.test.ts`:

- runtime config defaults missing theme to `dark`
- `saveTheme("light")` persists light
- `saveConfiguration`, `saveLocale`, and `clearConfiguration` preserve theme
- invalid stored theme resolves to `dark`

Existing tests that assert navigation labels should update to account for the
theme button in the header, but primary navigation order remains unchanged.

## Documentation Updates After Implementation

Update:

- `docs/ARCHITECTURE.md` with theme persistence and renderer class behavior.
- `docs/references/runtime-and-storage-surface.md` with config field and IPC
  channel.
- `docs/DESIGN.md` to say desktop supports light/dark aligned with frontend.
- `task-tracker.md` and completed ExecPlan after validation.

## Risks

- A broad CSS token change can miss low-visibility states such as dialogs,
  warnings, or disabled controls.
- Defaulting to dark changes first-run appearance from the old desktop light
  style. This is intentional for frontend alignment.
- Adding `lucide-react` changes `package.json` and `package-lock.json`; build
  validation must confirm the Electron bundle still resolves the icon package.

## Validation

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Manual visual QA:

- launch desktop runtime
- inspect Home, Local Skills, Updates, Settings drawer, configuration panel, and
  distribution confirmation dialog in both themes
- verify focus ring visibility with keyboard navigation
