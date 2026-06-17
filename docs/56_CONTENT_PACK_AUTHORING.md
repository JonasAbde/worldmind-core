# 56 — Content Pack Authoring Extensions (v1.0-rc11)

Sprint target: ship plan 54's short-term authoring targets.

## What this sprint delivers

Content pack grows from runtime data into designer-editable
gameplay metadata. The four new fields are loaded by the runtime,
exposed via read accessors, and validated by a new CLI:

| Field | Where | What it does |
| --- | --- | --- |
| `npcDialogueTopics[]` | `characters[].npcDialogueTopics` | NPC action button topics with trust gates + unlocks |
| `founderUnlockConditions[]` | `quests[].founderUnlockConditions` | Pack-driven founder unlock (incident + evidence + reputation variants) |
| `consequenceSummary` | `resolutionPaths[].consequenceSummary` | Human-readable summary of what this path achieves |
| `requiredEvidence[]` | `resolutionPaths[].requiredEvidence` | Evidence ids required before this path can be taken |

## Modules added

| Module | Purpose |
| --- | --- |
| `src/play/content-pack-authoring.js` | Read accessors + fallback derivation + founder unlock check + topic renderer |
| `src/cli/validate-content-pack-authoring.js` | Audits the content pack for the four new fields (25 structural checks) |

## Updated

| File | Change |
| --- | --- |
| `content/worldmind/content-pack-v1.json` | Adds `npcDialogueTopics` to all 5 characters, `founderUnlockConditions` to quest, `consequenceSummary` + `requiredEvidence` to all 3 resolution paths |
| `package.json` | Adds `validate:content-pack-authoring` script and a 21st `ci:gate` step |
| `docs/00_INDEX.md` | Entry for v1.0-rc11 |

## Tests

1 new test file: `test/v42-content-pack-authoring.test.js` (13 tests).
Total: **387/387** (up from 374).

## What this enables

Designers can now:

- Add new NPC dialogue topics without touching renderer code (the
  fallback derives topics from `dialogue[]` if no explicit list is set).
- Change founder unlock conditions via JSON (incident status, evidence
  threshold, reputation threshold — or a combination).
- Add consequence summaries per resolution path so the consequence
  panel can show "what does this path actually achieve?".
- Mark paths as requiring specific evidence before they are viable
  (used by `getRequiredEvidenceForPath` to gate path suggestions).

## Verification

```bash
npm test                                  # 387/387
npm run typecheck                         # clean
npm run ci:gate                           # 21 steps, all green
npm run validate:content-pack-authoring   # 25 structural checks
npm run validate:game-foundation          # still green (no regression)
npm run validate:web-play                 # still green
npm run validate:saves-ui                 # still green
```