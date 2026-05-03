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

- [x] Install the generated Windows `.exe`.
- [x] Launch the installed app.
- [x] Verify single-instance locking.
- [x] Verify close-to-tray and tray click toggling.
- [ ] Verify API configuration or expected missing-token state.
- [ ] Verify sync review state and explicit distribution behavior.
- [ ] Verify Local Skills inventory behavior.
- [ ] Verify theme and locale persistence.
- [x] Confirm generated `dist/` output is not committed.

## Bug Fix: Packaged Tray Icon Not Visible

- [x] Diagnose root cause: `windowsIconPath` resolved relative to `import.meta.url`
  inside `app.asar`, but `resources/icons/icon.ico` was not included in the
  asar or extraResources.
- [x] Add `extraResources` to `package.json` builder config to copy
  `resources/icons/icon.ico` to `resources/icons/icon.ico` outside the asar.
- [x] Add `resolveWindowsIconPath()` in `electron/main.ts` that uses
  `process.resourcesPath` when `app.isPackaged` is true.
- [x] Update icon embedding test to assert `resolveWindowsIconPath`,
  `app.isPackaged`, and `process.resourcesPath`.
- [x] Add `extraResources` assertion to package-scripts test.
- [x] Confirm `npm test` passes (19 files, 107 tests).
- [x] Confirm `npm run build` passes.
- [x] Confirm `npm run dist:win` generates artifacts with
  `resources/icons/icon.ico` present in `win-unpacked/`.
- [x] Re-test installed app tray icon visibility after fix.

## Archive Gate

- [ ] Record validation results in the active plan.
- [ ] Move this checklist and the plan to `docs/exec-plans/completed/` after
  release validation is complete or document why the plan was superseded.
