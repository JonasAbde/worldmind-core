# WorldMind Assets

This folder is reserved for visual assets for **WorldMind / HermesWorld Core**.

## Current status

The original Higgsfield Cloud API render attempt returned:

- `403 not_enough_credits`

A replacement V2 visual baseline has now been generated outside the repo with image generation and packaged for manual binary upload. The image binaries are intentionally **not committed in this text-only update**.

## Target asset set

Expected final paths:

- `hero/worldmind-cover.png` — key art for the project
- `concept/new-aarhus-district-01.png` — world mood / city concept
- `ui/hud-memory-permissions.png` — in-world HUD / memory-permissions interface
- `characters/npc-portrait-set.png` — NPC portrait direction
- `showcase/worldmind-v2-showcase.png` — 4-panel visual showcase for README/pitch usage

## Local package

The generated image package was prepared as:

- `worldmind-v2-assets.zip`

Unzip it into the repo root, then commit the binary PNG files manually:

```bash
git pull origin master
unzip worldmind-v2-assets.zip -d .
git add assets
git commit -m "Add WorldMind v2 visual asset baseline"
git push origin master
```

## Primary generation prompt

See `higgsfield-prompts.md` for the original prompt set. See `ASSET_MANIFEST.md` for the V2 baseline manifest and recommended usage.
