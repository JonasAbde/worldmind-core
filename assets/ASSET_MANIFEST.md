# WorldMind V2 Asset Manifest

## Status

Text-only manifest for the generated **WorldMind V2 visual baseline**.

The PNG image binaries are intentionally not included in this commit. They were generated externally and packaged for manual upload as `worldmind-v2-assets.zip`.

## Asset paths

| Path | Purpose | Recommended usage | Status |
|---|---|---|---|
| `assets/hero/worldmind-cover.png` | Main cinematic key art | README hero, landing page, pitch deck opening | Generated externally; binary pending manual commit |
| `assets/concept/new-aarhus-district-01.png` | New Aarhus District concept art | Product/world mood, city/world overview | Generated externally; binary pending manual commit |
| `assets/ui/hud-memory-permissions.png` | Memory/permissions HUD | Product UI moodboard, permission/memory section | Generated externally; binary pending manual commit |
| `assets/characters/npc-portrait-set.png` | NPC portrait sheet | Agent/NPC section, character direction | Generated externally; binary pending manual commit |
| `assets/showcase/worldmind-v2-showcase.png` | 4-panel visual showcase | README/pitch overview, investor/founder snapshot | Generated externally; binary pending manual commit |

## Visual direction

- Near-future Aarhus / New Aarhus 2035
- Cinematic game-key-art quality
- Grounded Nordic cityscape, not generic cyberpunk
- Subtle holographic overlays showing memory, permissions, relationships, goals, incidents, economy, and world state
- Premium dark UI with cyan/teal accents
- Simulation-first identity: people, purpose, permission, progression

## Naming contract

Keep these paths stable so README, docs, dashboards, and future landing pages can reference them without churn.

```txt
assets/hero/worldmind-cover.png
assets/concept/new-aarhus-district-01.png
assets/ui/hud-memory-permissions.png
assets/characters/npc-portrait-set.png
assets/showcase/worldmind-v2-showcase.png
```

## Manual binary commit

```bash
git pull origin master
unzip worldmind-v2-assets.zip -d .
git status --short
git add assets/hero/worldmind-cover.png \
  assets/concept/new-aarhus-district-01.png \
  assets/ui/hud-memory-permissions.png \
  assets/characters/npc-portrait-set.png \
  assets/showcase/worldmind-v2-showcase.png
git commit -m "Add WorldMind v2 visual asset baseline"
git push origin master
```

## Notes for future asset work

Do not overwrite this V2 baseline without preserving history. Future variants should use explicit suffixes, for example:

- `worldmind-cover-v3.png`
- `new-aarhus-district-02.png`
- `hud-memory-permissions-v3.png`
- `npc-portrait-set-v3.png`

The V2 baseline should remain the first official visual identity anchor until a deliberate V3 art direction is chosen.
