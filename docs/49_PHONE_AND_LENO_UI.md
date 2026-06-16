# 49 — v1.0-rc8 Phone + Leno UI

WorldMind v1.0-rc8 tilføjer et Phone panel med 8 tabs + Event Feed.

## Status

Implementeret i `src/play/web-renderer.js`.

## Phone panel

`renderPhoneTabs()` producerer:

- Button-array med `data-phone-tab` markers
- `<div data-phone-pane="...">` containers

Tabs:

1. Messages
2. Contacts
3. Rumors
4. Evidence
5. Jobs/Incident
6. Saves
7. Branches
8. Leno

## Leno overlay

Vises via `renderLeno(payload)`. Indeholder:

- Leno summary
- Safe/social/risky suggestions
- Hidden-truth guard status (ingen Nadia uden evidence)
- Known facts
- Unresolved questions

## Event Feed

`renderEventFeed(events)` viser:

- Sidste 12 events i `<ul data-event-feed">`
- Format: `type · dayd timetype · message`

Polling fra `/api/events` i live mode.

## Test

```bash
npm run validate:district-ui  # checker phone + event feed
npm run validate:leno       # checker guard
```