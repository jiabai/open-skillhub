# Upload Button Label Simplification

Status: canonical local product spec, implementation pending

## Purpose

Simplify the upload button label in the Local Skills view so that it displays
only the action text ("Upload" / "上传") without appending the skill name.
Each skill row already shows the skill name as its heading, so repeating it
inside the button is redundant and makes the button unnecessarily wide.

## Current Behavior

In `local-skills-view.tsx`, the upload button for each uploadable skill row
renders:

```tsx
{isUploading ? copy.uploading : copy.upload(name)}
```

The i18n strings are:

| Locale | Current value |
|--------|---------------|
| en-US  | `upload: (name: string) => `Upload ${name}`` |
| zh-CN  | `upload: (name: string) => `上传 ${name}`` |

This produces labels like "Upload my-skill" or "上传 my-skill", where the
skill name is already visible as the row heading directly above the button.

## Target Behavior

The upload button should display only the action word:

| Locale | Target value |
|--------|-------------|
| en-US  | `upload: "Upload"` |
| zh-CN  | `upload: "上传"` |

The `uploading` label ("Uploading..." / "上传中...") remains unchanged.

## Goals

- Remove the skill name parameter from the `upload` i18n string in both
  locales.
- Change the `upload` key from a function `(name: string) => string` to a
  plain `string` in the i18n type definition.
- Update the component to render `copy.upload` instead of `copy.upload(name)`.
- Keep the `uploading` label and all other local-skills-view strings unchanged.

## Non-Goals

- No changes to the upload logic, IPC flow, or error handling.
- No changes to other views or components that use skill names in their
  action buttons (e.g., the "Distribute {name}" button in the Home view).
- No changes to the layout, styling, or component structure of
  `local-skills-view.tsx`.

## Affected Files

| File | Change |
|------|--------|
| `src/i18n/messages/types.ts` | Change `upload: (name: string) => string` to `upload: string` |
| `src/i18n/messages/en-US.ts` | Change `upload: (name: string) => `Upload ${name}`` to `upload: "Upload"` |
| `src/i18n/messages/zh-CN.ts` | Change `upload: (name: string) => `上传 ${name}`` to `upload: "上传"` |
| `src/components/local-skills-view.tsx` | Change `copy.upload(name)` to `copy.upload` |

## Acceptance Criteria

- The upload button in the Local Skills view shows "Upload" (en-US) or "上传"
  (zh-CN) without the skill name.
- The `uploading` state label remains "Uploading..." / "上传中...".
- `npm test` passes.
- `npm run build` passes.
- `python scripts/validate_agents_docs.py --level ERROR` passes.
- `git diff --check` passes.

## References

- Local Skills view component: `../../src/components/local-skills-view.tsx`
- i18n type definitions: `../../src/i18n/messages/types.ts`
- English messages: `../../src/i18n/messages/en-US.ts`
- Chinese messages: `../../src/i18n/messages/zh-CN.ts`
