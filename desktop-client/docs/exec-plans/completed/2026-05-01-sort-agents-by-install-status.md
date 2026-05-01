# Sort Agents by Install Status Exec Plan

## Goal

Sort the AI coding assistant list in the "Agent Distribution Targets" module of the Settings drawer so that installed agents appear first and missing agents appear later for better user experience.

## Scope

- Modify `AgentsPanel` component in `src/components/agents-panel.tsx` to sort `agentStatuses`
- Sort installed agents first, then missing agents
- Keep the existing display format and functionality unchanged
- Update documentation if needed
- Run tests and validation to ensure the change works correctly

## Non-Goals

- No changes to agent detection logic
- No changes to agent status badges or labels
- No changes to i18n strings
- No changes to the agent detection service
- No changes to other components

## Implementation Steps

1. **Analyze current structure**: Review `agents-panel.tsx` and how `agentStatuses` are rendered
2. **Implement sorting logic**: Add a sort function that orders installed agents first, then missing agents
3. **Update rendering**: Use the sorted array for rendering the agent list
4. **Test validation**: Run tests to ensure the change works correctly without breaking anything

## Progress

- [x] Analyze current structure
- [x] Implement sorting logic
- [x] Update rendering
- [x] Test validation

## Validation Results

- `npm test` passed with 79 tests
- `npm run build` passed successfully

## Decisions

- Sort should be stable: installed agents keep their relative order, missing agents keep theirs
- Sort should be based on the `installed` boolean property in `AgentInstallStatus`
- Keep the sorting logic lightweight and local to the `AgentsPanel` component
- No changes to the data layer, only to the presentation layer

## Validation Plan

- `cd desktop-client && npm test`
- `cd desktop-client && npm run build`
- `python scripts/validate_agents_docs.py --level ERROR`

## Notes

- This is a UI/UX improvement, not a bug fix
- The change is scoped to the renderer UI layer only
- No architecture changes involved

## Outcome

- Completed on 2026-05-01. Agent list in Settings drawer now shows installed agents first, then missing agents, for better user experience.
