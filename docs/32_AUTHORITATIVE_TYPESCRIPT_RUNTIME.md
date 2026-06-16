# 32 — Authoritative TypeScript Runtime (v0.6)

## Goal

Promote the v0.5 TypeScript façades to **authoritative runtime** modules
and add the missing validation gates. After v0.6:

- `state.ts`, `scenario-loader.ts`, `world.ts`, and `sim.ts` are the
  authoritative runtime. The original `.js` siblings have been
  **removed**; callers import directly from the `.ts` files (Node ≥ 22
  strips types natively, no build step required).
- A consolidated `runtime.d.ts` declares the legacy `.js` modules
  (`memory.js`, `rumors.js`, `actions.js`, `relationships.js`,
  `economy.js`, `incidents.js`, `dashboard.js`, `dialogue.js`,
  `leno.js`). `utils.js` carries a focused `utils.d.ts` so `strict`
  typing for `makeRng` is exact.
- `strict: true` is reachable: a side-by-side `tsconfig.strict.json`
  passes with no errors after the type-shape refinements. The default
  `tsconfig.json` keeps `strict: false` for now because the legacy
  `.js` modules still don't carry inline types; flipping it as the
  default is a one-line change in a future sprint.

## Authoritative `.ts` modules

| File | Status | Notes |
|---|---|---|
| `src/simulation/state.ts` | Authoritative | scenarioToWorldState, validateScenarioSchema, serializeWorldState |
| `src/simulation/scenario-loader.ts` | Authoritative | loadScenarioFile, loadScenarioWorldState, buildWorldFromScenario |
| `src/simulation/world.ts` | Authoritative | createWorld + createSeedWorld + createWorldFromState |
| `src/simulation/sim.ts` | Authoritative | initializeScenario, runSimulation, tickWorld, evaluateWorld |

The four files were previously façades. Their bodies were copied out
of the legacy `.js` files, the legacy `.js` files were deleted, and
all internal imports updated to use the `.ts` extension.

## Type declarations for the legacy `.js` runtime

- `src/contracts/runtime.d.ts` — typed surface for nine legacy
  modules. `tsc` validates every import that touches them, but the
  runtime logic still lives in `.js`.
- `src/simulation/utils.d.ts` — focused declaration for `makeRng`
  and the rest of `utils.js`. This is what makes `strict: true`
  work for the world builder.

## New CLI gates

`src/cli/validate.js` now supports five subcommands:

- `node src/cli/validate.js scenario <path>`
- `node src/cli/validate.js snapshot <path>`
- `node src/cli/validate.js diff <path>`
- `node src/cli/validate.js branch <path>` ← new in v0.6
- `node src/cli/validate.js dashboard <dir>` ← new in v0.6

The `dashboard` subcommand reads `<dir>/index.html` and asserts that
all 15 expected sections are present (World Overview, Leno Panel,
Save Browser, Timeline Branches, etc.). A missing section triggers
a non-zero exit and a structured `errors` array.

## CI gate (6 steps)

`npm run ci:gate`:

1. `npm run typecheck`
2. `npm test`
3. `npm run check` (typecheck + MVP-eval)
4. `node src/cli/validate.js scenario scenarios/new-aarhus-district-01.json`
5. `node src/cli/validate.js branch scenarios/branch-v06-canonical.json`
6. `node src/cli/validate.js dashboard static-dashboard`

Any failure breaks the gate.

## Branch fixture

A canonical branch fixture lives at
`scenarios/branch-v06-canonical.json`. It is consumed by `ci:gate`
and by the v0.6 regression test for `parseBranch`.

## Tests

`test/v06-authoritative-ts.test.js` adds 11 regression tests:

- The four authoritative `.ts` modules each back at least one
  end-to-end scenario.
- `runtime.d.ts` is asserted to reference all nine legacy modules.
- `parseBranch` accepts a valid branch and rejects missing fields.
- `validate:branch` exits 0 on the canonical fixture and non-zero
  on a malformed input.
- `validate:dashboard` exits 0 on a freshly generated dashboard and
  non-zero when a section is removed.
- `ci:gate` is exercised end-to-end as part of the test suite.

## Acceptance

- `npm test` → 58/58 grøn
- `npm run typecheck` → 0 fejl
- `npm run check` → typecheck + MVP-eval passed
- `npm run ci:gate` → 6/6 gates grønne
- `npm start` → dashboard regenereret
- `npm run validate:scenario -- scenarios/new-aarhus-district-01.json` → `ok: true`
- `npm run validate:branch -- scenarios/branch-v06-canonical.json` → `ok: true`
- `npm run validate:dashboard` → `ok: true`, `sectionsChecked: 15`
- `strict: true` reachable: `npx tsc --noEmit -p <(echo '{"extends":"./tsconfig.json","compilerOptions":{"strict":true}}')` passes

## Next sprint

**Sprint 0.7: Strict-by-default + migrate legacy runtime to `.ts`**

- Flip `strict: true` in `tsconfig.json` once the legacy modules are
  migrated.
- Promote `memory.js`, `rumors.js`, `actions.js`, `relationships.js`,
  `economy.js`, `incidents.js`, `dashboard.js`, `dialogue.js`, and
  `leno.js` to authoritative `.ts` files (one sprint each, or
  batched). The `runtime.d.ts` becomes the source of truth for
  migration order.
- Add `validate:action` CLI that uses `parseAction` to validate
  ad-hoc action payloads before they're queued for execution.
- Extend `ci:gate` with a typed diff-checker that compares the
  canonical scenario against the current simulation's initial state
  and fails if drift is detected.
