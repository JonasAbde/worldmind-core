# Data Contracts and Validation

## Goal

Give WorldMind a typed contract layer and runtime validators for every
persisted or in-memory record, so the engine cannot drift into silent
data corruption and hidden truth cannot leak.

## Files

- `src/contracts/types.ts` — TypeScript interface definitions.
- `src/contracts/validators.js` — Runtime validators per contract.
- `src/contracts/leno-context.js` — Leno context builder.
- `src/contracts/index.js` — Facade re-exports.
- `tsconfig.json` — TypeScript project config (no emit, check only).
- `package.json` — `npm run typecheck` and `npm run check` chains.

## Contracts

- `WorldState`
- `Agent`, `Location`, `Item`, `Faction`
- `MemoryRecord`, `RumorRecord`, `IncidentRecord`, `TaskRecord`
- `EventRecord`
- `BranchMetadata`, `SnapshotMetadata`
- `ScenarioContract`, `WorldState`
- `ActionRequest`, `DiffContract`
- `LenoContext`

## Validators

Every validator returns `{ valid, errors }` so callers can either
fail fast (`throw`) or surface the message in dashboards/CLI.

| Validator | Purpose |
|---|---|
| `validateScenario` | top-level scenario JSON shape, agent/location/relationship/memory/rumor/incident/event integrity |
| `validateWorldState` | same checks, in-memory world state |
| `validateSnapshot` | snapshot record with branch metadata + event list |
| `validateBranch` | branch metadata (origin + parent required) |
| `validateMemory` / `validateRelationship` / `validateRumor` / `validateIncident` | per-record shape |
| `validateActionRequest` | actor + action + target ids must exist in world |
| `validateDiff` | diff contract version + section arrays |
| `validateLenoContext` | hiddenCause must be null, includeHiddenCause must be boolean |
| `diffContracts` | static section name list for diff contract evolution |

## Hidden truth guard

`buildLenoContext(world, { includeHiddenCause })` never returns
`hiddenCause` unless evidence is present and the caller opts in.
`validateLenoContext` re-checks that the value is `null` and that the
boolean flag is a boolean, so a future bug cannot leak the secret.

## TypeScript

`tsc --noEmit -p tsconfig.json` is wired into `npm run check`. The
current code is JSDoc-friendly, and the `.ts` types act as the
authoritative contract surface.

## Backward compatibility

All existing MVP tests still pass (`npm test` shows 33/33 green).
The new `validateScenario` is a superset of the original
`validateScenarioSchema` and is called by `loadScenarioFile`
automatically.

## Next steps

- Gradually move the .js source files to .ts and tighten `strict: true`.
- Add diff/memory/rumor/incident integration tests against the validator surface.
- Wire validators into CLI commands so users get explicit errors instead of thrown strings.
