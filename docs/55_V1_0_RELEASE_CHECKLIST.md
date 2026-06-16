# v1.0 Release Checklist

## Pre-Release

### 1. Full test suite

```bash
npm test
```
**Expected:** All tests pass. Currently verified at 201/201 tests.

### 2. Type check

```bash
npm run typecheck
```
**Expected:** No TypeScript errors.

### 3. Lint / check

```bash
npm run check
```
**Expected:** Type check + simulation assertion pass.

### 4. CI gate

```bash
npm run ci:gate
```
**Expected:** All validators pass.

### 5. Release verification

```bash
npm run release:verify
```
**Expected:**
- Static file hygiene ✓
- All command gates ✓
- Git state clean ✓

### 6. Safety audit

```bash
npm run audit:worldmind
```
**Expected:** All 7 checks pass:
- ✓ no hiddenCause secret text in HTML
- ✓ agent secrets redacted
- ✓ Leno evidence guard
- ✓ Risk tracking
- ✓ Creator filters unsafe permissions
- ✓ No real-world connectors
- ✓ Play-server has private redaction

### 7. Creator example validation

```bash
npm run creator -- validate scenarios/creator-example-district.json
```
**Expected:** Validation passes.

### 8. Leno validation

```bash
npm run validate:leno
```
**Expected:** All Leno checks pass.

### 9. Demo play

```bash
npm run demo:play
```
**Expected:** Automated walkthrough completes.

### 10. Play web

```bash
npm run play:web
```
**Expected:** `static-play/index.html` generated, no hiddenCause text.

## Git State

```bash
git status
git log --oneline -5
```
**Expected:** Clean working tree, correct base commit.

## Known Non-Goals (must NOT appear)

| Feature | Expected |
|---------|----------|
| 3D rendering | Not present |
| Multiplayer | Not present |
| Marketplace | Not present |
| React dashboard | Not present |
| LLM integration | Not present |
| Real-world connectors | Not present |

## Manual Smoke Test

1. `npm install` → no errors
2. `npm start` → dashboard output, simulation completes
3. `npm run play:web` → `static-play/index.html` opens in browser
4. `npm run creator -- --help` → subcommand list appears
5. Inspect `static-play/index.html` → no "Nadia planted a false rumor" text

## Tag Instructions

```bash
# Verify clean state
git status

# Tag
git tag -a v1.0.0-rc.1 -m "WorldMind v1.0.0-rc.1 — release candidate"
git push origin v1.0.0-rc.1

# Or tag as pre-release
git tag -a v1.0.0 -m "WorldMind v1.0.0"
git push origin v1.0.0
```

## Release Risks

| Risk | Mitigation |
|------|------------|
| SQLite native module fails on some platforms | Document `npm install --build-from-source` fallback |
| Canonical simulation changes between runs | RNG seed + event log ensures determinism |
| Static HTML rehydration mismatch | `state.json` sidecar for testing |
| Creator templates produce invalid scenarios | `creator validate` subcommand |
| hiddenCause leaks in generated UI | `redactWorldSecrets()` + `audit:worldmind` |

## Post-Release

- [ ] GitHub release created with notes from `docs/53_V1_0_RELEASE_NOTES.md`
- [ ] `docs/26_ROADMAP.md` updated with next milestone
- [ ] repo protected: `master`/`main` requires PR + CI pass
