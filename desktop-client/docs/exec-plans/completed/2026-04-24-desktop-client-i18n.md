# Desktop Client i18n Exec Plan

## Goal

Implement a local i18n system for `desktop-client` with `zh-CN` and `en-US`, persistent locale selection, locale-aware timestamps, and translated renderer UI.

## Scope

- Add a local i18n runtime under `desktop-client/src/i18n/`
- Persist locale in desktop local config alongside existing runtime settings
- Expose locale selection in the Settings drawer
- Translate the renderer shell, Home, Updates, Settings, configuration, and supporting panels
- Update tests to cover locale resolution, persistence, and basic UI rendering

## Phases

1. Define the locale model and config persistence changes.
2. Add the i18n runtime, dictionaries, provider, and hook.
3. Wire locale state through App and the Settings UI.
4. Translate the desktop-client renderer surface.
5. Add tests and run validation.

## Validation

- `cd desktop-client && npm test`
- `cd desktop-client && npm run build`

## Notes

- Keep the behavior aligned with frontend locale codes, but do not reuse Next.js cookie/request plumbing.
- Treat desktop local config as the source of truth for the selected locale.

## Status

- `completed`: desktop-client now persists locale locally, renders translated UI, and formats timestamps by locale

## Validation

- `cd desktop-client && npm test`
- `cd desktop-client && npm run build`

## Notes

- The final renderer behavior is aligned with the frontend locale model but uses local desktop persistence instead of Next.js cookies.
- The locale switch is protected against late startup config hydration so user-selected language does not get overwritten.
