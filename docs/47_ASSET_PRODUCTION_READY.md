# 47 — Asset Production Ready Pack

## Status

A production-ready WorldMind game asset package has been prepared outside the repo as a commit-ready ZIP.

The package converts the generated concept/UI sheets into a structured game asset layer:

- visual identity assets
- game UI assets
- world/location assets
- character assets
- narrative/content assets
- WebP sidecars
- prototype audio cues
- production manifest

## Generated output

Prepared package:

```txt
worldmind-production-assets-repo-ready.zip
```

Expected unpacked paths:

```txt
assets/
content/
ASSET_PRODUCTION_MANIFEST.json
README_ASSET_PRODUCTION.md
GIT_COMMIT_COMMANDS.md
```

## Production work completed

- Character sheets were cropped into portraits, avatars, neutral expressions, focused expressions, worried/concerned expressions.
- Location scenes were converted into reusable location cards.
- Missing apartment scene was derived and added for registry compatibility.
- Location SVG icons were generated for cafe, market, workshop, district square, and apartment.
- UI sheets were sliced into reusable component templates for evidence, rumor, memory, relationships, incidents, Leno overlay, and buttons.
- WebP sidecars were generated for web performance.
- Prototype audio cues were generated for click, evidence, rumor, incident, Leno notification, and ambient New Aarhus.
- Structured JSON content files were added for episodes, dialogue, incidents, rumors, evidence, quests, and resolution paths.

## Commit commands

Run from repo root after extracting the ZIP:

```bash
git pull origin master
cp -R assets content ASSET_PRODUCTION_MANIFEST.json README_ASSET_PRODUCTION.md .
git status --short
git add assets content ASSET_PRODUCTION_MANIFEST.json README_ASSET_PRODUCTION.md
git commit -m "Add WorldMind production game asset pack"
git push origin master
```

## Validation commands

```bash
node src/cli/validate-game-foundation.js
node src/cli/play-server.js --dry-run
node --test test/v16-game-foundation.test.js
```

## Note

The GitHub connector can safely write text files, but binary asset upload is handled through the generated ZIP so the repo tree is not corrupted by partial binary commits.
