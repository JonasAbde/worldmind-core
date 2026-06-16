# MVP Build Plan

## Current completed foundation

- In-memory world state.
- 10 NPCs + player.
- 4 locations.
- Actions.
- Memory.
- Relationships.
- Rumors.
- Economy.
- Incident detection.
- Daily checkpoint logging.
- Dialogue v0.1.
- Leno policy.
- Static dashboard.
- Tests/evals.

## Next build order

1. Add SQLite persistence.
2. Add TypeScript types.
3. Add JSON scenario loader.
4. Build React dashboard.
5. Add save snapshots/timeline branch.
6. Add richer dialogue package.
7. Add agent schedule system.
8. Add faction pressure mechanics.
9. Add creator mode prototype.
10. Add model router abstraction.
11. Add LLM integration behind deterministic mocks.
12. Add 2D map view.
13. Then evaluate 3D client.

## Development gate

Every core mechanic needs:

- unit test.
- eval check.
- doc update.
- no hidden-truth leak.
