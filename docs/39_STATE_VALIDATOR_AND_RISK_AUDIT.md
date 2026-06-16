# 39. State validator and risk-action audit (v0.9)

## validate:state

Asserts that a JSON file has every key from the canonical
`WorldState` contract. Useful for catching snapshot corruption,
scenario authoring mistakes, or runtime serialization drift.

```bash
npm run validate:state                          # canonical scenario
npm run validate:state -- path/to/state.json    # arbitrary state file
```

The validator checks the following 19 top-level keys:

```
kind, version, id, name, tick, day, time,
agents, locations, items, factions,
memories, rumors, incidents, tasks,
events, relationshipEvents,
playerKnowledge, economy
```

It also asserts:

- `kind` is `'world_state'`
- `version` is `2`
- `tick` is a non-negative number
- `day` is a positive number
- `time` is a non-empty string
- `agents`, `locations`, `playerKnowledge`, `economy` are objects
- `events`, `relationshipEvents` are arrays

## validate:risk --strict

`validate:risk` checks the action risk policy (Risk 4/5 forbidden).
`validate:risk --strict` adds a **permission audit** that asserts:

- Every action in the registry has a `permission:` field that
  resolves to a real `PERMISSIONS.*` value.
- The permission is one of the canonical permissions.
- The `ACTIONS.X` key is mapped to a real actionId.

The strict report includes a `permissionAudit` array:

```json
{
  "ok": true,
  "kind": "risk",
  "totalActions": 19,
  "maxRisk": 3,
  "disabledGated": 0,
  "mvpLimit": 3,
  "strict": true,
  "permissionAudit": [
    { "actionId": "move_to_location", "permission": "move", "risk": 0 },
    { "actionId": "talk_to_agent", "permission": "talk", "risk": 1 },
    ...
    { "actionId": "ask_leno", "permission": "leno_access", "risk": 0 }
  ]
}
```

This catches:

- An action registered with a permission that doesn't exist in
  `PERMISSIONS` (typo like `PERMISSIONS.TRADE_FOOD`).
- An action whose permission is real but unused by any agent.
- A misaligned actionId (e.g. an entry that maps to a nonexistent
  runtime action).

## CI gate

`ci:gate` runs `validate:risk --strict` and `validate:state` as
part of the 12-step pipeline. Any regression on either audit fails
the gate before merge.
