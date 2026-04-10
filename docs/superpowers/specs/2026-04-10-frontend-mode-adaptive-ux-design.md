# Frontend Mode-Adaptive UX Design

Date: 2026-04-10
Status: Approved for spec drafting
Scope: `frontend/` information architecture and UX redesign for `ENABLE_RBAC=false` and `ENABLE_RBAC=true`

## 1. Goal

Redesign the frontend so it behaves like two coherent products under one codebase:

- `no-rbac`: a personal Skill workspace centered on private Skills, public Skill reuse, and client token access
- `rbac`: an organization console centered on governance, scoped collaboration, visibility management, audit, and user administration

This redesign does not need backward-compatibility concessions for a previously released frontend. The priority is to establish the clearest and most rational product structure now, while keeping the route layer largely stable.

## 2. Problem Statement

The current frontend has partial adaptability through scattered feature flags and a small amount of role-based rendering, but it does not present a coherent product experience for either runtime mode.

Current issues:

- The app does not model a first-class frontend runtime mode such as `appMode = no-rbac | rbac`
- Navigation is partly gated by flags and user role, but not by product mode
- `dashboard` behaves like a generic control panel instead of a mode-specific starting point
- `public-skills`, `skills`, `skill detail`, and `tokens` expose backend capabilities but do not guide users through the intended task flow
- No-RBAC pages do not consistently explain that the system is a personal workspace plus public library
- RBAC pages are not framed as governance and collaboration surfaces
- Important states such as `reference`, `clone`, pin/follow-latest, and download restrictions are not explained clearly enough in page structure

## 3. Product Positioning

### 3.1 No-RBAC mode

`ENABLE_RBAC=false` should be treated as:

`Personal private Skill space + public Skill library + token-based client access`

Primary user goals:

- discover usable Skills from the public library
- convert a public Skill into a personal `reference` or `clone`
- manage personal private/reference/clone Skills
- create tokens so external clients can access visible Skills

The frontend should optimize for clarity, onboarding, and task completion for an individual user.

### 3.2 RBAC mode

`ENABLE_RBAC=true` should be treated as:

`Organization and team console for scoped Skill collaboration and governance`

Primary user goals:

- manage Skills in a role-aware environment
- understand visibility scope and ownership boundaries
- administer users and roles where permitted
- inspect audit activity and governance signals

The frontend should optimize for governance, scope awareness, and administrative control.

## 4. Design Principles

1. Product mode is a first-class concept.
2. Information architecture must change with mode, not only individual buttons.
3. No-RBAC mode should be task-oriented, not admin-dashboard-oriented.
4. RBAC mode should be governance-oriented, not personal-workspace-oriented.
5. Page headers, empty states, badges, and action areas must explain behavior, not just expose API fields.
6. The route layer should remain mostly stable so code reuse stays high.
7. Shared pages may exist, but their page copy, layout emphasis, and action priority can differ by mode.

## 5. Frontend Runtime Model

Introduce a first-class frontend concept:

```ts
type AppMode = "no-rbac" | "rbac"
```

`AppMode` should not be inferred indirectly from unrelated flags at render time. It should come from a dedicated frontend-readable configuration source that mirrors backend runtime mode.

Required behavior:

- layout navigation is generated from `appMode`
- dashboard entry experience is generated from `appMode`
- page copy and empty states can branch by `appMode`
- sections such as audit, user management, visibility controls, and governance hints can be consistently enabled or deprioritized

Out of scope for this phase:

- splitting the app into separate route trees
- separate deployments for each mode
- maintaining old UX for compatibility reasons

## 6. Navigation Design

### 6.1 No-RBAC navigation

Primary navigation:

- `Workspace` or `Home`
- `Public Skills`
- `My Skills`
- `Tokens`
- `Profile`
- `Security`

Behavior notes:

- `Public Skills` is a primary entry, not a secondary catalog
- `My Skills` explicitly means the user's own working set
- `Audit` and `Users` do not appear as first-class navigation items in this mode, even if routes exist

### 6.2 RBAC navigation

Primary navigation:

- `Overview`
- `Skills`
- `Public Skills`
- `Tokens`
- `Audit`
- `Users`
- `Profile`
- `Security`

Behavior notes:

- `Skills` is not framed as "mine"; it is framed as the set manageable within the user's scope
- `Audit` and `Users` are valid first-class destinations in this mode

## 7. Dashboard Design

### 7.1 No-RBAC dashboard

This page should stop behaving like a generic metrics console and instead become a task-oriented workspace home.

Proposed sections:

- `Start Here`
  - card: browse public Skills
  - card: upload your own Skill
  - card: create a token for client access
- `My Workspace Snapshot`
  - my Skills count
  - my tokens count
  - relevant recent state such as active Skills or latest usable version status
- `Need To Know`
  - this mode is a personal private space
  - public Skills are reusable but not directly editable
  - `reference` vs `clone` summary

The first screen should answer:

- what this mode is
- what I should do first
- what boundaries apply

### 7.2 RBAC dashboard

This page can remain closer to a governance overview.

Proposed sections:

- `Team / Org Overview`
- `Skill Governance`
- `Audit & Access`
- `Pending Actions`

The first screen should answer:

- what is happening in my scope
- what governance actions matter now
- what requires attention

## 8. Key Page Task Flows

### 8.1 Public Skills

In `no-rbac`, this becomes a main onboarding page.

Required UX changes:

- add a top explainer that distinguishes:
  - `Reference`: best for using now with minimal ownership cost
  - `Clone`: best for code changes and long-term maintenance
  - `Download`: best for taking an archive artifact
- surface a recommended action on each card
  - default recommendation for first-time users: `Add Reference`
- after success, provide explicit next step:
  - reference created -> go to `My Skills`
  - clone created -> go to the new Skill detail page
- explain download restrictions in plain language when blocked

In `rbac`, the same page can still exist, but its framing shifts from onboarding to reusable organizational capability sourcing.

### 8.2 My Skills / Skills

In `no-rbac`, this page should explicitly present itself as the user's personal workspace.

Required UX changes:

- page header explains it contains only the user's `private`, `reference`, and `clone` Skills
- card design visually distinguishes those types beyond a small badge
- empty state offers two explicit actions:
  - go to `Public Skills` and add a `reference`
  - upload your own ZIP

In `rbac`, the same route can keep the name `Skills`, but the copy should refer to managed scope rather than personal ownership.

### 8.3 Skill Detail

This page must explain behavior, not just render fields.

Required UX changes:

- clearly show whether the Skill is `Private`, `Reference`, or `Clone`
- if `Reference`, clearly show:
  - following latest
  - pinned to a specific version
- disabled actions must include reason text
  - example: cannot upload files because this Skill is a reference to a public source
- version actions must explain:
  - pin / unpin
  - download meaning
  - rollback meaning
- files section should indicate that the listed files belong to the currently effective version

### 8.4 Tokens

This page should become a two-step access page:

- create token
- connect client

Required UX changes:

- after token creation, show next-step guidance instead of only showing the token value
- explain that browser-side Skill management and client-side Skill usage are different steps
- empty state should explicitly say that without a token, clients cannot access otherwise visible Skills

### 8.5 Task chain

No-RBAC task chain should be explicit in page-to-page guidance:

`Workspace -> Public Skills -> My Skills -> Tokens`

RBAC task chain is different and should guide users toward:

`Overview -> Skills / Audit / Users`

## 9. Copy and State Strategy

The redesign requires stronger explanatory copy in:

- page headers
- section intros
- empty states
- disabled button helper text
- success feedback
- post-action next-step prompts

States that must become first-class explanations:

- personal workspace vs governed scope
- `reference` vs `clone`
- following latest vs pinned version
- visible vs editable vs downloadable
- why a management surface is absent or deprioritized in `no-rbac`

## 10. Functional Additions Required

The redesign is mostly UX and IA, but it needs a few concrete frontend additions:

1. A dedicated frontend runtime mode source for `appMode`
2. Mode-aware navigation configuration
3. Mode-aware dashboard composition
4. Reusable explanatory UI blocks for:
   - `reference` vs `clone`
   - mode boundary explanations
   - post-success next steps
5. Stronger success states that include links to next destinations

Potentially useful but optional in this phase:

- dismissible onboarding panel in no-RBAC mode
- small recommendation labels on public Skill cards

## 11. Error Handling

The frontend should translate backend outcomes into task-language messages.

Examples:

- download forbidden in no-RBAC:
  - do not only show "permission denied"
  - explain that in no-RBAC mode users can only download Skills they own
- reference read-only:
  - explain that the Skill points to a public source, so file upload and metadata editing are restricted
- public Skill editing unavailable:
  - explain that public Skills are reusable but not editable here

## 12. Testing Strategy

The redesign should be validated at three levels:

1. Configuration-level rendering
   - navigation changes correctly between `no-rbac` and `rbac`
2. Page behavior
   - dashboard sections differ by mode
   - `Public Skills` shows mode-appropriate guidance
   - `Skills` page uses correct personal vs scoped framing
3. Critical action feedback
   - reference creation success guidance
   - clone success guidance
   - token creation next-step guidance
   - disabled-state explanations render correctly

## 13. Implementation Notes

Recommended implementation approach:

- keep route structure mostly stable
- create an app-level mode helper and mode-aware navigation config
- refactor page headers and empty states first
- then refactor dashboard and `public-skills`
- then refine `skills`, `skill detail`, and `tokens`

This order improves perceived UX fastest in no-RBAC mode while keeping the design extensible for RBAC mode.

## 14. Decisions

- Use a first-class `appMode`
- Keep routes mostly stable
- Use dual-mode information architecture inside one frontend
- Prioritize no-RBAC as a personal task-oriented workspace
- Treat RBAC as a governance-oriented console
- Make `Public Skills` a primary onboarding surface in no-RBAC
- Make `Tokens` a create-and-connect surface rather than only a credential list

## 15. Non-Goals

- preserving the current dashboard semantics
- preserving current page wording for compatibility
- full standalone onboarding wizard in this phase
- splitting the frontend into two separate applications
