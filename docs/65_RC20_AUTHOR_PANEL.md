# 65 — Browser Authoring Panel (v1.0-rc20)

Ship target: designers can edit the worldmind content pack in-browser
without touching code. New `/author.html` route + `/api/content` endpoint
with auth + schema validation + hot-reload.

## What this sprint delivers

### 1. Authoring UI (`static-play/author.html` + `author.js`)

A dedicated page at `/author.html` for editing the content pack
(`content/worldmind/content-pack-v1.json`). Features:

- **5 editor tabs**: Dialogue, Resolution Paths, Incidents, Rumors, Evidence
- **Per-section JSON editor** (textarea with JSON validation)
- **Format JSON** button (re-formats with 2-space indent)
- **Reload from disk** (re-fetches without saving)
- **Save changes** (POSTs the full pack, server validates, writes atomically)
- **Author key** field (sends `X-AUTHOR-KEY` header when set)
- **Status banner** (idle / ok / error feedback)
- **Ctrl/Cmd+S keyboard shortcut** for save
- **Live help text** (per section) explaining the schema

### 2. Server endpoints (`src/cli/play-server.js`)

- `GET /api/content` — read the content pack
- `POST /api/content` — write the content pack (after validation)

Both endpoints:
- Auth-gated by `WM_AUTHOR_KEY` env var (no auth in dev)
- Use the rc12 scenario schema for validation before write
- Atomic file write (tmp + rename) so partial writes don't corrupt the pack
- Bump `version` and `updatedAt` on every save
- Hot-reload: `clearContentPackCache()` invalidates the scenario loader's
  in-memory cache so `/api/state` reads the new pack on next call

### 3. Navigation link

Topbar in `static-play/index.html` now shows an "Author" link
next to the world name. Clicking opens `/author.html` in a new tab.

## Files added (no new deps)

| File | Purpose |
|------|---------|
| `static-play/author.html` | Authoring UI shell |
| `static-play/author.js` | Authoring UI client (fetch, validate, save) |
| `test/v55-author-panel.test.js` | 6 tests for the panel |

## Files updated

- `src/cli/play-server.js` — `/api/content` GET + POST endpoints
- `src/play/visual-game-shell.js` — Author link in topbar
- `static-play/index.html` — regenerated via `npm run play:web`

## Tests

| Suite | Status |
|-------|--------|
| v55 (author panel) | **6/6 grønne** |
| `npm test` total | 438/438 grønne (was 432) |
| ci:gate | 25 steps, all green |

## Auth

Set `WM_AUTHOR_KEY` in your environment to enable auth:

```bash
WM_AUTHOR_KEY=mysecretplay node src/cli/play-server.js
```

Without this var, the endpoints accept any request (dev mode).
Production deployments MUST set the key.

## Hot-reload flow

1. Designer edits dialogue in `/author.html`
2. Click "Save changes" → POST /api/content with full pack
3. Server validates against schema
4. If valid: writes to `content-pack-v1.json.tmp` then renames
5. Clears `clearContentPackCache()` so next `/api/state` reads fresh
6. Designer can immediately re-run scenario in `/3d.html` and see new content

## Manual smoke test

```bash
# 1. Start the server
WM_DB_PATH=$PWD/data/qa-rc20.sqlite node src/cli/play-server.js --port=8770 &

# 2. Get the content pack
curl -s http://127.0.0.1:8770/api/content | python -m json.tool | head -20

# 3. Edit and POST
curl -X POST http://127.0.0.1:8770/api/content \
  -H 'content-type: application/json' \
  -d @content/worldmind/content-pack-v1.json
# → { "ok": true, "version": 2, "bytes": 12345 }

# 4. Verify version bumped
curl -s http://127.0.0.1:8770/api/content | python -c "import sys,json; d=json.load(sys.stdin); print('version:', d['version'], 'updatedAt:', d.get('updatedAt'))"

# 5. Visit http://127.0.0.1:8770/author.html in a browser
#    Click "Dialogue" tab, edit a line, click "Save changes"
```

## Known limitations

1. **No granular patch.** Author panel sends the FULL pack on every save.
   For small edits this is fine; for large packs (1000s of entries) a
   PATCH endpoint would be more efficient. Deferred to v1.1.
2. **No multi-user locking.** Two designers editing the same section
   concurrently will overwrite each other. A "last write wins"
   strategy is acceptable for solo authoring. Locking is post-v1.0.
3. **No version history / diff viewer.** Each save overwrites. Use
   git to recover previous versions. v1.0 ships with the assumption
   that git is the source of truth.
4. **No JSON validation preview.** Errors show as text, not as
   highlighted lines. A Monaco/CodeMirror integration would be a
   nice future sprint.

## Next sprint

- **rc21 — Ship-ready infra** (release:verify, prod deploy smoke, audit)
- **v1.0.0 — Tag the release**