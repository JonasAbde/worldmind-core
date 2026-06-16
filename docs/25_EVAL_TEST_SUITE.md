# Eval / Test Suite

## Commands

```bash
npm test
npm run typecheck
npm run check
npm run ci:gate
npm run validate:risk
npm run validate:event-log
npm run diff:canonical
npm run diff:event-log
```

## Existing tests

- world initializes with agents/locations/secrets.
- 7-day simulation passes MVP criteria.
- The Missing Delivery is detected and resolved in the canonical run.
- Leno does not leak hidden truth before evidence.
- malformed / missing-target / zero-value actions are blocked.
- dashboard export includes overview, incident and event-log sections.
- dialogue is topic/relationship aware.
- scenario loader validates the canonical JSON world.
- SQLite persistence can save, restore, and branch a snapshot.
- event-log metadata carries branch origin information.
- Rune evidence can unlock Nadia-source tracing without secret-memory leaks.
- v0.4 data contracts: scenario/snapshot/diff/branch shape and required fields.
- v0.5 TypeScript runtime: `tsc --noEmit` passes against the migrated `.ts` files.
- v0.6 authoritative runtime: validate:branch and validate:dashboard.
- v0.7 strict typescript default: validate:action + typed diff-checker (scenario drift + mutation).
- v0.8 strict invariants: utils.ts is authoritative, strictNullChecks is true, validate:risk + validate:event-log + diff:event-log, hidden-truth regression test for Leno.
- v0.9 per-event-type schemas: validateEventPayloadByType (soft + strict modes), validate:state, validate:risk --strict with permission audit, 100/100 tests grøn.
- v1.0-rc1 typed payload migration: alle 9 event-emitters migreret til typed `payload`-felter, `validate:event-log` flipped til strict mode som default, Leno `lenoTickPayload` evidence gate, canonical 7-dages sim 0 violations / 123 events, 116/116 tests grøn.

## Eval criteria

After 7 simulated days:

- 10+ agents active.
- 4+ locations touched.
- 20+ memories.
- 10+ relationship changes.
- 5+ rumor spread events.
- 3+ economy pressure events.
- Missing Delivery detected.
- 3+ quest resolutions available.
- snapshot round-trip works.
- scenario-loaded world matches canonical invariants.
- hidden truth stays locked until evidence exists.

## Future tests

- permission escalation blocked.
- prompt injection through dialogue blocked.
- false rumors can be corrected with evidence.
- locked memories persist.
- timeline branch restore works.
- creator-generated agent cannot receive admin tools.
- diff-based save replay stays deterministic.
