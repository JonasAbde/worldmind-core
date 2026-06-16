# 31 — TypeScript Runtime Migration (v0.5)

## Goal

Migrate the WorldMind simulation core to TypeScript **gradually**, without
breaking the MVP flow. The runtime stays in plain ESM JavaScript; TypeScript
provides a typed surface and a single source of truth for the world
contracts.

## Strategy: façade shims

For each runtime module we ship a sibling `.ts` shim that re-exports the
runtime's types. The shim is type-checked by `tsc --noEmit` and is **not**
imported at runtime — the existing `.js` ESM module continues to be the
authoritative implementation.

| Runtime module                | TypeScript shim                          |
|-------------------------------|------------------------------------------|
| `src/simulation/state.js`     | `src/simulation/state.ts`                |
| `src/simulation/scenario-loader.js` | `src/simulation/scenario-loader.ts` |
| `src/simulation/world.js`     | `src/simulation/world.ts`                |
| `src/simulation/sim.js`       | `src/simulation/sim.ts`                  |
| `src/contracts/parse.js`      | `src/contracts/parse-types.d.ts`         |

This keeps `npm test`, `npm start` and the static dashboard completely
unaffected, while `tsc` now has a fully typed view of the contracts.

## Why not flip `strict: true` immediately?

`strict: true` would force every existing `.js` file to satisfy `noImplicitAny`
and `strictNullChecks`. With the codebase still in active MVP-sprint
iteration, that would either lock the design prematurely or require a large
batch of `// @ts-ignore` workarounds. The façade approach lets us:

1. Add a type-checked call site every time we touch a module.
2. Promote individual files to full `.ts` once their contracts stabilise.
3. Flip `strict: true` once all runtime modules are either `.ts` or carry
   a declaration file.

A later sprint will promote the shims to authoritative `.ts` modules and
turn on `strict: true` module-by-module.

## Parse wrappers

`src/contracts/parse.js` exports Zod-lite style parsers:

- `parseScenario(input)`, `parseWorldState(input)`, `parseSnapshot(input)`,
  `parseBranch(input)`, `parseAction(input, world?)`, `parseDiff(input)`

Each delegates to the existing validator and **throws** on invalid input.
The type signature lives in `parse-types.d.ts`, so the rest of the codebase
sees a typed shape from a single import.

## CLI gates

`src/cli/validate.js` is the canonical CLI. It supports three subcommands:

- `node src/cli/validate.js scenario <path>`
- `node src/cli/validate.js snapshot <path>`
- `node src/cli/validate.js diff <path>`

When the path is `-` the CLI reads from stdin. Each subcommand exits
non-zero on validation failure and prints a structured JSON report.

NPM aliases:

- `npm run validate:scenario -- <path>`
- `npm run validate:snapshot -- <path>`
- `npm run validate:diff -- <path>`

## CI gate

`npm run ci:gate` runs:

1. `npm run typecheck` (`tsc --noEmit -p tsconfig.json`)
2. `npm test`
3. `npm run check` (typecheck + MVP-eval)
4. `node src/cli/validate.js scenario scenarios/new-aarhus-district-01.json`

Any failure breaks the gate.

## Files

- `tsconfig.json` (existing) — `noEmit: true`, `allowJs: true`,
  `resolveJsonModule: true`, `types: ["node"]`
- `src/contracts/types.ts` (existing) — all shared contracts
- `src/contracts/parse.js` (new) — runtime parsers
- `src/contracts/parse-types.d.ts` (new) — typed surface for parsers
- `src/cli/validate.js` (new) — CLI entry point
- `src/simulation/state.ts` (new) — façade
- `src/simulation/scenario-loader.ts` (new) — façade
- `src/simulation/world.ts` (new) — façade
- `src/simulation/sim.ts` (new) — façade
- `test/v05-ts-runtime.test.js` (new) — 14 regression tests
- `docs/31_TYPESCRIPT_RUNTIME_MIGRATION.md` (this file)

## Acceptance

- `npm test` → 47/47 grøn
- `npm run check` → MVP-eval `passed: true`
- `npm run typecheck` → ingen fejl
- `npm run validate:scenario -- scenarios/new-aarhus-district-01.json` → `ok: true`
- `npm start` → dashboard regenereret

## Next sprint

**Sprint 0.6: Promote façades to authoritative `.ts` and turn on `strict: true`**

- Move the body of `state.js`, `scenario-loader.js`, `world.js` and `sim.js`
  into the existing `.ts` files. Keep `.js` as a thin re-export shim until
  all callers have been migrated.
- Flip `strict: true` in `tsconfig.json` once the four target files are
  fully typed and the other simulation files (memory, rumors, actions,
  relationships, economy, incidents) have either migrated or carry `.d.ts`
  declarations.
- Extend the CI gate with a typed `validate:dashboard` check that asserts
  the static HTML still renders all expected sections.

## v0.8 update

Sprint 0.8 extended the migration to its natural conclusion:

- `src/simulation/utils.js` (the last remaining JS file in `src/simulation/`)
  was migrated to `src/simulation/utils.ts`. See `docs/32_STRICT_NULL_CHECKS.md`.
- `strictNullChecks: true` was flipped on. 26 nullable-access sites across
  `actions.ts`, `dialogue.ts`, `economy.ts`, `memory.ts`, `relationships.ts`,
  `rumors.ts` were fixed with explicit `?? 0` / `?? ''` / `?? []` defaults.
- `ci:gate` was extended to 10 steps: `validate:risk`, `validate:event-log`,
  and `diff:event-log` were added. See `docs/33_EVENT_LOG_INVARIANTS.md` and
  `docs/34_RISK_VALIDATION.md`.

The TypeScript runtime is now the only runtime.
