# WorldMind v1.0 Release Notes

> **WorldMind** is a simulation-first AI game engine where agents, locations, and incidents emerge from deterministic rules — not scripted plots.

## v1.0.0-rc — Release Candidate

### What's New

#### Core Engine
- **Deterministic simulation** — Same seed always produces identical world state
- **Event Log is the source of truth** — All state changes flow through an immutable event log
- **Leno (Evidence Agent)** — Player's memory and evidence tracker; can only report known facts, player-observed facts, public rumors, or evidence-backed claims
- **Hidden Truth system** — Incidents have a `hiddenCause` known only to the engine; evidence guards prevent premature disclosure
- **Risk 4/5 actions** remain gated by default

#### CLI Commands

| Command | Description |
|---------|-------------|
| `npm start` | Run 7-day simulation with dashboard |
| `npm run play` | Interactive CLI play session |
| `npm run demo:play` | Automated demo walkthrough |
| `npm run play:web` | Generate static HTML play UI (`static-play/`) |
| `npm run play:server` | Start live play server |
| `npm run saves:list` | List all snapshots |
| `npm run saves:timeline` | Show branch timeline |
| `npm run saves:diff` | Diff two snapshots |
| `npm run sim:from-snapshot` | Continue from a snapshot |
| `npm run sim:branch` | Create a branch |
| `npm run creator -- --help` | Scenario authoring CLI |
| `npm run validate:leno` | Validate Leno evidence guards |
| `npm run release:verify` | Full release gate |
| `npm run audit:worldmind` | Safety audit |

#### Simulation Features
- 11 agents with relationships, goals, skills, and memories
- 4 locations: Apartment, Sara's Café, Malik's Workshop, Market Street
- Economy system (food scarcity, prices, agent money)
- Rumor propagation with truth level and distortion
- Incident resolution system (The Missing Delivery — fully playable)
- Faction influence tracking

#### Creator Mode
- `npm run creator -- agent` — generate agent templates
- `npm run creator -- location` — generate location templates
- `npm run creator -- incident` — generate incident templates
- `npm run creator -- scenario` — build scenario packs
- `npm run creator -- validate` — validate scenario JSON

#### Persistence
- SQLite-backed snapshots and branches
- Deterministic restore via RNG state
- Branch-based exploration (fork from any snapshot)

### Verified Invariants

- Event log is append-only and deterministic
- Leno never reveals `hiddenCause` without evidence
- `private` memory content is never shipped to browser
- Agent secrets are redacted in public UI payload
- Risk 4/5 actions are gated in MVP
- No real-world connectors (no API calls, no weather, no external services)
- Hidden truth: "Nadia planted a false rumor" never appears in generated HTML

### Non-Goals (Not in v1.0)

- ❌ 3D rendering
- ❌ Multiplayer
- ❌ Marketplace
- ❌ React dashboard
- ❌ LLM integration
- ❌ Real-world data connectors
- ❌ Mobile app

### System Requirements

- Node.js >= 20
- No external API keys required
- No database server (SQLite is local-file)
- ~50MB disk space

### Project Structure

```
src/
  cli/          — All CLI commands (simulate, play, creator, validates)
  simulation/   — Core engine (world, agents, events, memory, Leno)
  persistence/  — SQLite adapter, snapshot/branch storage
  play/         — Play runtime and web rendering
scenarios/      — Canonical and creator example scenarios
static-play/    — Generated play UI (gitignored)
data/           — SQLite database files (gitignored)
docs/           — Full documentation
test/           — Node.js test suite
```

### For Founders

Start here:

```bash
npm install
npm start                    # See the dashboard
npm run play                 # Interactive CLI session
npm run play:web             # Open static-play/index.html in browser
npm run creator -- --help   # Build your own scenarios
```

### Documentation

- `docs/00_INDEX.md` — Full documentation index
- `docs/54_INSTALL_AND_RUN_GUIDE.md` — Setup guide
- `docs/26_ROADMAP.md` — Future plans
- `docs/55_V1_0_RELEASE_CHECKLIST.md` — Release checklist
