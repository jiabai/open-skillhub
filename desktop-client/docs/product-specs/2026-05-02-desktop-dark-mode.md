# Desktop Dark Mode

## Goal

Add a one-click light/dark theme toggle to the SkillDrive desktop client and
align its dark visual language with the web console frontend.

The desktop client remains a focused review utility. Dark mode should improve
comfort for long-running tray sessions without adding a second settings
workflow or changing sync, distribution, upload, or agent filesystem behavior.

## Scope

- Add a visible theme toggle in the desktop header action area near Refresh and
  Settings.
- Support two explicit modes: `dark` and `light`.
- Default new and unset desktop configuration to `dark`, matching the frontend
  `ThemeProvider` default.
- Persist the operator's choice in the existing desktop JSON config so the theme
  survives app restart.
- Apply the active theme immediately after the user clicks the toggle.
- Use the frontend console as the source of visual alignment:
  - `.dark` class semantic theme switching
  - dark neutral background and card surfaces
  - muted foreground text
  - restrained borders
  - compact outline/icon toggle pattern
- Keep theme state in renderer-safe configuration metadata; no token, file
  contents, or privileged desktop capability is exposed.
- Add English and Chinese copy for the toggle label and mode state.

## Non-Goals

- No backend API change.
- No database or SQLite migration.
- No automatic OS theme sync in v1.
- No three-state `system` theme selector in v1.
- No Tailwind, shadcn, or `next-themes` dependency in the desktop client.
- No redesign of Home, Updates, Local Skills, Settings, or dialogs beyond theme
  token coverage.

## Frontend Alignment Source

The web console currently uses:

- `frontend/src/components/theme-provider.tsx`
  - `next-themes`
  - `attribute="class"`
  - `defaultTheme="dark"`
- `frontend/src/components/app/theme-toggle.tsx`
  - one button
  - toggles `dark` and `light`
  - shows `Sun` in dark mode and `MoonStar` in light mode
- `frontend/src/app/globals.css`
  - `.dark` class changes semantic tokens for background, foreground, card,
    muted, border, primary, accent, destructive, and ring colors

The desktop implementation should copy the behavior and semantic intent, not the
frontend dependency stack.

## User Experience

### Header Action

The header action row should include a compact theme toggle. The button must be
reachable by keyboard, have an accessible label, and visually communicate the
next action or current state.

Recommended order:

```text
Pending badge | Refresh | Theme toggle | Settings
```

### Theme Behavior

- On first launch with no saved theme, desktop opens in dark mode.
- Clicking the toggle switches immediately to the other mode.
- The chosen theme is saved through the Electron main process.
- Restarting the app uses the saved theme.
- If the bridge is unavailable in tests or renderer-only dev, the renderer may
  still use the default dark theme but must surface normal bridge-unavailable
  behavior for persisted configuration actions.

### Visual Requirements

Dark mode should feel consistent with the frontend console:

- dark neutral page background
- slightly lighter card and drawer surfaces
- low-contrast borders
- readable muted text
- high-contrast primary actions
- visible destructive, warning, success, and accent states
- no bright cream panels left behind on dark surfaces

Light mode should keep the current desktop visual language.

## Persistence Contract

Extend the existing desktop configuration state with:

```typescript
type AppTheme = "light" | "dark"

interface ConfigurationState {
  theme: AppTheme
}
```

The theme is not secret. It may live in `config/config.json` beside locale and
API Base URL.

## Acceptance Criteria

- Theme toggle appears in the desktop header.
- Toggle changes the active theme with one click.
- Toggle state is available in English and Chinese locales.
- Dark mode covers body, header, cards, badges, buttons, drawers, dialogs,
  callouts, inputs, update rows, Local Skills rows, and pre-distribution summary
  states.
- Theme choice persists across runtime reload and app restart.
- `ConfigurationState` carries the redacted active theme to the renderer.
- Desktop does not import frontend Tailwind, shadcn, or `next-themes`.
- Renderer still has no direct Node or Electron privileged access.
- Focus states remain visible in both modes.
- Existing desktop tests and build still pass.

## Validation

Implementation must pass:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Manual visual QA should inspect light and dark mode at the desktop target
window size after implementation.
