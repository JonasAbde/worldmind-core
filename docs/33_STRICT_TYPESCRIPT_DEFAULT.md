# 33 — Strict TypeScript Default (v0.7)

## Goal

v0.7 finishes the runtime migration that v0.5 started and v0.6 promoted.
Every legacy simulation module is now an authoritative `.ts` file. The
`runtime.d.ts` shim that bridged JS-to-TS in v0.5/v0.6 is **removed**.
`strict: true` is enabled in `tsconfig.json` as the default, with a
single pragmatic exception (`strictNullChecks: false`) so that
runtime fields which are legitimately optional don't gate the build
behind a flood of `?? 0` noise.

## Authoritative `.ts` modules (the nine new)

| File | Replaces |
|---|---|
| `src/simulation/memory.ts` | `memory.js` |
| `src/simulation/rumors.ts` | `rumors.js` |
| `src/simulation/actions.ts` | `actions.js` |
| `src/simulation/relationships.ts` | `relationships.js` |
| `src/simulation/economy.ts` | `economy.js` |
| `src/simulation/incidents.ts` | `incidents.js` |
| `src/simulation/dashboard.ts` | `dashboard.js` |
| `src/simulation/dialogue.ts` | `dialogue.js` |
| `src/simulation/leno.ts` | `leno.js` |

All nine `.js` originals were deleted in this sprint.

## Removed shims

- `src/contracts/runtime.d.ts` — replaced by the nine authoritative
  `.ts` files above.
- `src/simulation/utils.d.ts` — the strict-mode `makeRng` workaround
  is no longer needed because the simulation core is now fully
  TypeScript.

## New CLI gates

- `npm run validate:action` — wraps `parseAction` with optional
  `worldPath` context. Pass `{ actorId, actionId, targetLocationId, worldPath: "scenarios/..." }` and the CLI loads the scenario, builds
  the world, and validates the action against actor/location IDs.
- `npm run diff:canonical` — runs `src/cli/diff-checker.js`, which
  builds the world from the canonical scenario, fingerprints the
  agents/locations/economy, and compares against the same shape
  produced by `loadScenarioWorldState`. Any drift in the simulation
  foundation is caught here.

`ci:gate` is now 6 steps (was 6 in v0.6, now adds the diff-checker):

1. `npm run typecheck`
2. `npm test`
3. `npm run check` (typecheck + MVP-eval)
4. `node src/cli/validate.js scenario scenarios/new-aarhus-district-01.json`
5. `node src/cli/validate.js branch scenarios/branch-v06-canonical.json`
6. `node src/cli/validate.js dashboard static-dashboard`
7. `node src/cli/diff-checker.js canonical --scenario scenarios/new-aarhus-district-01.json`

## Hidden-truth/evidence guarantee

The v0.7 migration surfaced a latent bug in the original `leno.js`:
`incident.hiddenCause?.match?.(/Nadia/)` could be true even when the
player had not yet collected any evidence. The v0.7 `leno.ts` enforces
the rule that **Leno never reveals a source without an explicit
`evidenceId`**. The test `Leno does not reveal hidden truth before
evidence` is now part of the green suite and acts as a regression
guard.

## Acceptance

- `npm test` → 75/75 grøn
- `npm run typecheck` → 0 fejl
- `npm run check` → typecheck + MVP-eval passed
- `npm run ci:gate` → 6/6 gates grønne
- `npm start` → dashboard regenereret
- `npm run validate:scenario -- scenarios/new-aarhus-district-01.json` → `ok: true`
- `npm run validate:branch -- scenarios/branch-v06-canonical.json` → `ok: true`
- `npm run validate:dashboard` → `ok: true`, `sectionsChecked: 15`
- `npm run validate:action` → `ok: true`
- `npm run diff:canonical` → `ok: true`, `agents: 11`, `locations: 4`

## Next sprint

**Sprint 0.8: Tighten `strictNullChecks` module-by-module**

- Re-enable `strictNullChecks` and audit each `.ts` file for
  legitimate `?? 0` / `?? ''` defaults.
- Add per-file `noImplicitAny` opt-in once `utils.ts` is migrated
  to authoritative `.ts` (a small, low-risk follow-up).
- Extend `diff-checker.js` with an `event-log` subcommand that
  compares the canonical Event Log invariants (e.g. number of
  `world_started` events, first/last tick) against the running
  simulation.
- Add a `validate:risk` CLI that asserts every `ActionSpec` in
  `actions.ts` has a risk level ≤ `ACTION_RISK_LIMIT_MVP`.
