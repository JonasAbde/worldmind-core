# WorldMind Landing / Product Assets

This folder contains **marketing and landing page assets** only.

Do NOT use these as runtime gameplay sprites — they are not wired into `src/play/assets.js`.

## Structure

```
assets/landing/
  *.png                      — master PNGs (source of truth)
  generated/
    webp/*.webp               — full-size WebP conversions
    responsive/*-640.webp     — responsive 640px wide
    responsive/*-1280.webp    — responsive 1280px wide
    responsive/*-1920.webp    — responsive 1920px wide
```

## Files

| File | Purpose |
|---|---|
| `worldmind-hero-key-art.png` | Hero section key art |
| `new-aarhus-district-01.png` | District/world mood section |
| `missing-delivery-case-board.png` | Feature: evidence/rumor system |
| `leno-evidence-guard.png` | Feature: Leno AI companion |
| `simulation-hud-memory-permissions.png` | Feature: simulation HUD |
| `timeline-branches.png` | Feature: save browser / branch timeline |
| `save-browser-snapshot-diff.png` | Feature: snapshot diff |
| `npc-agent-portrait-set.png` | NPC agent section |
| `worldmind-og-image.png` | Open Graph / social share image |
| `worldmind-app-icon.png` | App icon / favicon source |

## Status

These are currently sourced from the best available runtime/concept assets.
A dedicated landing art pass is needed before public launch — see `docs/51_ASSET_ART_LOCK_LANDING_AND_RUNTIME_PLAN.md`.
