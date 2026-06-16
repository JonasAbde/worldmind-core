# Eval / Test Suite

## Commands

```bash
npm test
npm run check
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
