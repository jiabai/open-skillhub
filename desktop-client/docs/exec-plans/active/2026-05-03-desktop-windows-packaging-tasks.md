# Desktop Windows Packaging Task Checklist

Status: active

## Documentation Gate

- [x] Review root `WORKFLOW.md` and `docs/EXECUTION_GATES.md`.
- [x] Review desktop `AGENTS.md`, architecture, design, security, task tracker,
  product spec index, and ExecPlan index.
- [x] Inspect current packaging specs in English and Chinese.
- [x] Inspect current `package.json`, `package-lock.json`, icon resources,
  Electron main process, README, and app paths before correcting docs.
- [x] Correct the English product spec.
- [x] Correct the Chinese product spec.
- [x] Add packaging technical design.
- [x] Add active ExecPlan.
- [x] Add this implementation checklist.
- [x] Update README, architecture, runtime reference, product/design indexes,
  task tracker, and active plan index.
- [x] Run documentation validation after all doc edits.
- [x] Run whitespace diff validation after all doc edits.

## Future Implementation Gate

- [x] Review and decide whether `package.json` metadata needs release fields
  such as description, author, publisher, or copyright.
- [x] Review and decide whether runtime `APP_USER_MODEL_ID` should match the
  builder `appId`.
- [x] If approved, make the smallest package metadata/AppUserModelID changes.
- [x] Confirm `npm run build` still behaves as the standard development build.
- [x] Confirm `npm run dist:win` generates expected Windows artifacts.

## Future Manual Validation Gate

- [ ] Install the generated Windows `.exe`.
- [ ] Launch the installed app.
- [ ] Verify single-instance locking.
- [ ] Verify close-to-tray and tray click toggling.
- [ ] Verify API configuration or expected missing-token state.
- [ ] Verify sync review state and explicit distribution behavior.
- [ ] Verify Local Skills inventory behavior.
- [ ] Verify theme and locale persistence.
- [x] Confirm generated `dist/` output is not committed.

## Archive Gate

- [ ] Record validation results in the active plan.
- [ ] Move this checklist and the plan to `docs/exec-plans/completed/` after
  release validation is complete or document why the plan was superseded.
