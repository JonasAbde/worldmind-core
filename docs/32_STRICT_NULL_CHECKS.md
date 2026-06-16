# 32. Strict null checks (v0.8)

## Goal

Flip `strictNullChecks: true` in `tsconfig.json` so that every `.ts`
file in `src/` is checked against the full strict TypeScript surface,
not just `strict: true` with `strictNullChecks: false`.

## Why v0.7 used `strictNullChecks: false`

The v0.7 migration was about getting the entire simulation runtime to
TypeScript. Many runtime fields are legitimately optional — agents
have `money`, `stress`, `revenue` etc. that may or may not be set on
a given `AgentStats` object. Forcing every read to assert `?? 0` or
`?? ''` would have been a sprawling refactor with no functional gain
in the same sprint. v0.8 is the sprint that does that audit.

## What changed in v0.8

- `tsconfig.json`: `"strictNullChecks": true` (was `false`).
- 26 strictNullChecks errors caught and resolved across
  `actions.ts`, `dialogue.ts`, `economy.ts`, `memory.ts`,
  `relationships.ts`, `rumors.ts`, `state.ts`.
- All fixes use explicit `?? 0` / `?? ''` / `?? []` defaults
  rather than `!` non-null assertions or `as any` casts.
- The migration is now genuinely strict: every nullable access is
  acknowledged and the runtime contract is documented in place.

## What stayed out

`noUncheckedIndexedAccess` is still off. Indexed access on
`world.agents[actorId]` is treated as returning `T` (not `T | undefined`)
because the runtime invariant is that any actor referenced in an
event must exist in `world.agents`. The runtime guards this with
explicit `if (!actor) throw` paths before dereferencing, and the
validators catch invalid refs at scenario load time. Tightening this
flag would force a defensive read on every agent/location lookup
throughout the runtime with no functional gain.

## Files that now require a nullable default

| File | Fields / expressions |
|---|---|
| `actions.ts` | `actor.stats.money`, `target.stats.money`, `sara.stats.stock`, `rel.fear`, `targetAgentId` cast in event payloads |
| `dialogue.ts` | `rel.fear` in Rune trust/fear branch |
| `economy.ts` | `sara.stats.stock`, `sara.stats.stress` |
| `memory.ts` | `memory.emotionalWeight`, `memory.confidence`, `memory.decayRate`, `memory.relatedAgentIds`, `memory.relatedLocationIds` |
| `relationships.ts` | `r.debt` in `calculateAcceptance`, `rel.debt` in `decayRelationships` |
| `rumors.ts` | `rumor.targetAgentIds[0]`, `rumor.createdAtTick`, `rumor.spreadRate`, `source.personality.warmth`, `source.personality.ambition` |

## Verification

```bash
npm run typecheck    # passes with strictNullChecks: true
npm test             # 89/89 grøn
npm run ci:gate      # 10/10 grøn
```

## Migration tip

When auditing, prefer the safest read pattern:

```ts
const value = obj.field ?? defaultValue;     // preferred
const value = obj.field as Type;             // only when invariant is provable
const value = obj.field!;                    // never used in v0.8
const value = obj.field as any;              // never used in v0.8
```
