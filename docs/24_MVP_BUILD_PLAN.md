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
- Optional SQLite persistence foundation.
- World snapshots and timeline branches.
- JSON scenario loader.
- Deterministic regression coverage.

## Next build order

1. Add richer save browser / timeline UI.
2. Add incremental event replay / diff saves.
3. Add TypeScript types.
4. Add richer dialogue package.
5. Add agent schedule system.
6. Add faction pressure mechanics.
7. Add creator mode prototype.
8. Add model router abstraction.
9. Add LLM integration behind deterministic mocks.
10. Add 2D map view.
11. Then evaluate 3D client.

## Development gate

Every core mechanic needs:

- unit test.
- eval check.
- doc update.
- no hidden-truth leak.
