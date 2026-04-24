# Task Plan

## Goal

Add desktop-client i18n support with shared locale codes, persistent locale selection, translated renderer UI, and locale-aware date formatting.

## Phases

1. Discovery and scope confirmation - complete.
2. Write a local desktop-client spec and execution plan - complete.
3. Implement the i18n runtime, dictionary, provider, and locale persistence.
4. Wire the renderer and settings UI to the locale state and toggle.
5. Translate the main desktop-client views and shared UI primitives.
6. Add and update tests, then run validation.

## Success Criteria

- The desktop client supports `zh-CN` and `en-US`.
- Locale selection persists in desktop local config.
- The renderer reads locale from configuration and updates without a restart.
- Date/time display uses the active locale.
- Core desktop-client tests and build pass.

## Status

- `in_progress`: phase 3.
