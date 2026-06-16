# 34. Risk validation (v0.8)

## Goal

Risk 4 and Risk 5 actions must NEVER exist in the MVP runtime. The
`RISK` enum exposes `RESTRICTED` (4) and `WORLD_CHANGING` (5) so
the type system can describe what is gated, but the action
registry in `actions.ts` is forbidden from using them. v0.8 adds
a CLI gate that fails CI if any high-risk action sneaks in.

## Constants

```ts
// src/simulation/constants.ts
export const RISK = {
  OBSERVE: 0,
  SMALL_SOCIAL: 1,
  MEDIUM_SOCIAL: 2,
  RUMOR: 3,
  RESTRICTED: 4,        // not allowed in MVP
  WORLD_CHANGING: 5     // not allowed in MVP
};

export const ACTION_RISK_LIMIT_MVP = RISK.RUMOR;  // = 3
```

## CLI

```bash
npm run validate:risk
```

Prints:

```json
{
  "ok": true,
  "kind": "risk",
  "totalActions": 19,
  "maxRisk": 3,
  "disabledGated": 0,
  "mvpLimit": 3
}
```

Exits non-zero with `disabledGated > 0` if any action's risk
exceeds the MVP limit, or if a canonical `ACTIONS.X` constant is
missing from the registry.

## How it works

The validator (`src/contracts/risk-validator.js`) parses
`actions.ts` source code at runtime. It looks for lines of the form:

```ts
[ACTIONS.X]: { permission: PERMISSIONS.Y, risk: RISK.N }
```

and extracts `(actionId, riskLevel)` pairs. The runtime value of
`ACTIONS.X` is resolved via the `ACTIONS` constant map.

A small set of internal/reflect actions
(`accept_task`, `complete_task`, `create_memory`,
`reflect_on_event`, `leno_summarize`, `leno_suggest_actions`) are
intentionally absent from the runtime registry because they are
helpers, not player-facing actions. The validator allows that
absence and flags only missing *player-facing* actions.

## Why source-parsing instead of import

Importing the action registry would require TypeScript transpilation
or a runtime that can evaluate `.ts`. Source-parsing is fast
(<10ms), works in any Node process, and catches the bug we care
about: someone adding a `risk: RISK.RESTRICTED` line to the
registry. The next `npm run ci:gate` fails.

## Adding a new action

1. Add the action id to `ACTIONS` in `constants.ts`.
2. Register it in `actions.ts` with `risk: RISK.OBSERVE` (or any
   value 0-3).
3. Run `npm run validate:risk`. It must pass.

If you genuinely need a Risk 4/5 action, the change requires a
deliberate update to `ACTION_RISK_LIMIT_MVP` and a separate
agreement that the action should be available to the player — at
which point the action is no longer MVP.
