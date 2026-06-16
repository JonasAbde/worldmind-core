# Release Hardening — v1.0-rc10

**Goal:** Make WorldMind release-ready without new gameplay features.

## Scope

- GitHub Actions CI pipeline
- `npm run release:verify` — full release gate
- `npm run audit:worldmind` — safety audit
- Documentation updates (README, docs)
- No new gameplay features
- No LLM integration
- No React

## CI Pipeline

**File:** `.github/workflows/ci.yml`

Runs on every push and pull request to `master`/`main`:

| Job | Steps |
|-----|-------|
| `test` | `npm ci` → `typecheck` → `check` → `test` |
| `validate` | `validate:leno` → `validate:district-ui` → `validate:saves-ui` → `validate:creator` |
| `demo` | `npm ci` → `demo:play` |
| `release-gate` | `npm run release:verify` |
| `audit` | `npm run audit:worldmind` |

## Release Verify

**File:** `src/cli/release-verify.js`

Full gate (any failure exits 1):

1. Static file hygiene checks
   - `static-play/index.html` and `state.json` exist
   - No `.sqlite` files committed
   - No `hiddenCause` secret text in HTML
   - `creator-example-district.json` is valid
2. All command gates
3. Git state (branch, dirty check)

## Safety Audit

**File:** `src/cli/audit-worldmind.js`

Checks:

| Check | Requirement |
|-------|-------------|
| `hiddenCause` secret text | Must NOT appear in static HTML |
| Agent secrets | Must be `[]` in browser state |
| Leno evidence guard | Must exist in `web-renderer.js` |
| Risk tracking | Must exist in `actions.js` |
| Creator permissions | No `admin`/`world_change` terms |
| Real-world connectors | No `http://api.*` / weather / stripe / etc. |
| Play-server redaction | `private`/`secrets` handling present |

## Package Hygiene

- `data/*.sqlite` — not committed (`.gitignore`)
- `static-play/` — generated, not committed
- `static-dashboard/` — generated, not committed
- No dead scripts in `package.json`
- All scripts have working exit codes

## Non-Goals (still apply)

- No 3D
- No multiplayer
- No marketplace
- No React dashboard
- No LLM integration
- No real-world connectors

## Dependencies

`better-sqlite3 ^12.11.1` — local-first SQLite, no cloud dependency.
