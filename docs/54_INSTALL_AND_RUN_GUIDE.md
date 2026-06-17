# Install and Run Guide

## Quick Start

```bash
git clone <repo>
cd worldmind-core
npm install
npm start
```

That's it. No API keys. No external services for the basic simulation.

## Requirements

- **Node.js >= 20** (check with `node --version`)
- **Git**
- **~50MB disk space**

Optional (for the procedural asset builder, rc15-rc17):
- **Python 3.11+** with `numpy`, `Pillow`, `trimesh`, `pygltflib`, `scipy`
  (pre-installed in the Hermes venv; for production CI add a
  `requirements.txt` and `pip install -r requirements.txt`)

## Commands

### Run the simulation

```bash
npm start              # 7-day simulation + dashboard output
npm run simulate       # Same, no dashboard
npm run check          # Type check + assertion run
```

### Interactive play

```bash
npm run play           # CLI interactive play
npm run demo:play      # Automated demo walkthrough
```

### Web UI

```bash
npm run play:web       # Generate static-play/index.html
# Open static-play/index.html in your browser
npm run play:server    # Start live server (for browser play)
```

### Saves / Timeline

```bash
npm run saves:list     # List all snapshots
npm run saves:timeline # Show branch timeline
npm run saves:diff     # Diff two snapshots
npm run sim:from-snapshot  # Continue from snapshot
npm run sim:branch        # Create a new branch
```

### Creator mode (build your own scenarios)

```bash
npm run creator -- --help
npm run creator -- agent --name "MyAgent" --role merchant
npm run creator -- location --name "Shop" --zone-type commercial
npm run creator -- incident --title "Theft" --visible-problem "missing goods"
npm run creator -- scenario --agents agents.json --locations locs.json --incidents incs.json
npm run creator -- validate scenarios/my-scenario.json
```

### Validation

```bash
npm test               # Full test suite
npm run typecheck      # TypeScript check
npm run check          # Type check + simulation assertion
npm run validate:leno  # Leno evidence guard validation
```

### Release

```bash
npm run release:verify  # Full release gate (all validators)
npm run audit:worldmind  # Safety audit
```

## Troubleshooting

### `better-sqlite3` fails to install

```bash
npm install --build-from-source
```

On Windows with MSVC build tools required. Alternative: use pre-built binary.

### Tests fail

```bash
npm test -- --test-name-pattern="<test name>"  # Run single test
```

### `npm run check` fails with assertion error

The simulation assertion verifies that day 7 state matches a known canonical result. If the canonical simulation has changed (new seed, new logic), update the assertion data.

### Static HTML doesn't load in browser

`static-play/` is gitignored and generated fresh each time:

```bash
npm run play:web
# Then open static-play/index.html
```

## Project Structure

```
Project Worldmind/
├── src/
│   ├── cli/          # All CLI commands
│   ├── simulation/   # Core engine
│   ├── persistence/  # SQLite adapter
│   └── play/        # Play runtime + web UI
├── scenarios/        # Scenario JSON files
├── static-play/      # Generated HTML UI (gitignored)
├── data/             # SQLite DB files (gitignored)
├── docs/             # Documentation
└── test/             # Test suite
```

## Uninstall

```bash
rm -rf node_modules
# Optionally remove generated files:
rm -rf static-play data/*.sqlite
```
