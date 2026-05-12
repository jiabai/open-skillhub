# Redesign Profile as an Identity + Settings Center

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

## Purpose / Big Picture

The current `/profile` page behaves like a form-first settings page. After this work,
users should land on a page that first explains who they are in the system, what
their current account status is, which workspace role they hold, and where they sit
in the organization model before it asks them to edit anything.

The visible result should be simple to demo: open `/profile` and see an identity
summary card first, then the editable basic profile form, then the bind-new-email
workflow. The page should explain platform identity and organization membership
without exposing raw technical metadata.

## Progress

- [x] (2026-04-18 18:50) Defined the target redesign and created this ExecPlan in `docs/exec-plans/active/`.
- [x] (2026-04-18 18:58) Refactored the profile UI into an identity-first page with a dedicated summary component.
- [x] (2026-04-18 18:59) Reused shared role and status display semantics so profile and admin user management stay aligned.
- [x] (2026-04-18 19:00) Extended localized copy and targeted frontend tests for the new profile behaviors.
- [x] (2026-04-18 19:02) Ran `npm.cmd run test -- --run src/__tests__/pages.test.tsx`; the targeted page test file passed with 22/22 tests green.

## Surprises & Discoveries

- Observation: The existing profile page already fetches a full `User` payload from `/api/v1/users/me`, including `is_superuser`, `role`, `status`, `enterprise_id`, and `team_id`.
  Evidence: `frontend/src/app/profile/page.tsx` imports `User` and stores the full `api.getMe()` response.

- Observation: The admin users page already defines the effective badge semantics for user role and account status.
  Evidence: `frontend/src/app/admin/users/page.tsx` uses role-based badge variants and `USER_STATUS_BADGE_VARIANTS`.

- Observation: The default frontend test mock for `api.getMe()` is currently underspecified for identity-first rendering.
  Evidence: `frontend/src/test/setup.ts` returns only `username`, `email`, and `is_superuser` in the default mock.

- Observation: The admin users page and the new profile identity summary need the same role and status wording, but that logic previously lived only inside the admin page.
  Evidence: `frontend/src/app/admin/users/page.tsx` contained local badge mapping logic before the shared helper was added in `frontend/src/lib/user-identity-display.ts`.

- Observation: The new identity summary component needs to handle the loading state on its own so the page can keep a stable top-to-bottom layout while profile data is still being fetched.
  Evidence: `frontend/src/app/profile/page.tsx` now renders `UserIdentitySummary` before the editable cards, even while `api.getMe()` is pending.

## Decision Log

- Decision: Keep `/security` separate from this redesign.
  Rationale: High-risk actions such as account deletion belong in a dedicated safety-oriented flow; `/profile` should become the main identity and low-risk settings page.
  Date/Author: 2026-04-18 / Codex

- Decision: Show workspace role only when it is meaningful.
  Rationale: Always showing the default non-RBAC member role adds noise for most users; it becomes important when RBAC is enabled, the user is privileged, or the role differs from the default.
  Date/Author: 2026-04-18 / Codex

- Decision: Present organization info as summary-first and raw-ID-second.
  Rationale: Enterprise and team IDs are useful support artifacts, but they are not user-friendly primary content.
  Date/Author: 2026-04-18 / Codex

- Decision: Reuse `usersAdmin` labels and badge semantics from a shared helper instead of introducing profile-only mappings.
  Rationale: Role and status wording should remain consistent everywhere the console explains identity, and a small helper keeps the mapping logic from drifting.
  Date/Author: 2026-04-18 / Codex

## Outcomes & Retrospective

The `/profile` page now behaves like an identity + settings center instead of a
form-first page. The first card is an identity summary that always shows platform
identity and account status, conditionally shows workspace role only when it is
meaningful, and conditionally shows organization placement only when the org model
capability is enabled.

The redesign also extracted shared frontend identity display helpers so the profile
page and the admin users page now use the same role and status label rules. This
keeps profile-language drift from creeping in over time.

Out of scope by design:

- `/security` remains a separate page for higher-risk actions.
- No backend API or schema changes were required.
- No technical metadata such as user ID or timestamps were added to the UI.

Follow-up ideas, if we choose to continue later:

- Add organization names in addition to raw IDs once the backend exposes them.
- Consider reusing the identity-summary component in other “who am I in this scope”
  surfaces if the product adds them.

## Context and Orientation

The current profile implementation lives in `frontend/src/app/profile/page.tsx`.
That page already fetches the current authenticated user through `api.getMe()` and
lets the user edit `username` and `email`, plus bind a new email through a
verification-code flow.

The current user contract comes from `backend/schemas/user.py` and is represented in
the frontend by `frontend/src/types/index.ts`. It already includes:

- `is_superuser`: platform-level privilege flag
- `role`: workspace role string such as `admin`, `member`, or `viewer`
- `status`: account lifecycle state
- `enterprise_id` and `team_id`: organization placement identifiers

The admin user-management page in `frontend/src/app/admin/users/page.tsx` already
contains the linguistic and visual conventions for user role and status badges. The
profile redesign should treat those conventions as the source of truth rather than
inventing a new language.

Localized copy for the profile page lives in:

- `frontend/src/i18n/messages/zh-CN.ts`
- `frontend/src/i18n/messages/en-US.ts`
- `frontend/src/i18n/messages/types.ts`

## Plan of Work

First, add a new active exec-plan entry to `docs/exec-plans/active/index.md` so the
work is discoverable through the normal repo planning map.

Next, create a small dedicated identity-summary component under
`frontend/src/components/app/` so profile-specific identity presentation is
isolated from form handling. That component should accept the loaded user record,
runtime capabilities, and localized copy, then render platform identity, account
status, optional workspace role, and optional organization membership in a
summary-first layout.

Then, extract the role/status display rules needed by both profile and admin-user
management into a shared frontend helper so badge semantics and labels do not drift.

After that, refactor `frontend/src/app/profile/page.tsx` to reorder the page:

1. Identity Summary
2. Basic Profile
3. Bind New Email

Finally, extend localized copy and the targeted page tests so the redesigned
identity-first behavior is covered by assertions.

## Concrete Steps

Work from the repository root:

    cd D:\Github\skilldrive

Create and register the plan:

    1. Add `docs/exec-plans/active/profile-identity-settings-center-plan.md`.
    2. Update `docs/exec-plans/active/index.md` with the new file entry.

Implement the frontend redesign:

    1. Add a shared identity display helper under `frontend/src/lib/`.
    2. Add `frontend/src/components/app/user-identity-summary.tsx`.
    3. Refactor `frontend/src/app/profile/page.tsx` to render the summary card first.
    4. Update `frontend/src/app/admin/users/page.tsx` to reuse shared identity display helpers where appropriate.
    5. Extend `frontend/src/i18n/messages/types.ts`, `frontend/src/i18n/messages/zh-CN.ts`, and `frontend/src/i18n/messages/en-US.ts`.
    6. Update `frontend/src/test/setup.ts` so `api.getMe()` returns a full user shape by default.
    7. Extend `frontend/src/__tests__/pages.test.tsx` with profile-specific identity assertions.

Validate:

    cd frontend
    npm.cmd run test -- --run src/__tests__/pages.test.tsx

Expected result:

    - the test file passes
    - profile assertions verify identity summary ordering and conditional visibility

## Validation and Acceptance

Validation and Acceptance:

Validation flow:
1. Open `/profile` while authenticated.
2. Confirm the first card on the page is an identity summary, not the editable form.
3. Confirm platform identity and account status are always visible.
4. Confirm workspace role is only shown when RBAC is enabled, the user is privileged, or the role is non-default.
5. Confirm organization membership is only shown when `org_model` is enabled, and that raw IDs appear only as secondary badges.
6. Confirm no technical metadata such as user ID or timestamps appear on the page.

Test verification:
- Run `npm.cmd run test -- --run src/__tests__/pages.test.tsx` from `frontend/`.
- Expect the test file to pass.
- New profile identity tests should fail against the old profile layout and pass after the redesign.
