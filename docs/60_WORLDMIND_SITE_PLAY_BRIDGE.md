# WorldMind Site — Play Portal Bridge (checklist)

Repo: `JonasAbde/worldmind-site` (separate from core).

## Goal

`/play` on the marketing site connects to **worldmind-core** `play-server` using `docs/PLAY_API_CONTRACT.md` — no duplicate gameplay.

## Prerequisites (core — unified play rc.2)

- [x] `GET /api/state` returns `gameShell`
- [x] `GET /api/health` returns `apiVersion`
- [x] CORS via `WM_CORS_ORIGIN`
- [x] Visual gameplay shell merged (rc.2) — richest UI from `gameShell`
- [x] Founder unlock from incident resolution (v22 — all three resolution paths)
- [x] Founder contract loop + tier promotion (v22)
- [x] Rumor runtime fields on world rumors (v23)
- [x] Counter-rumor backfire when evidence is weak (v23.10)
- [x] Action outcome delta envelope on player commands (v21)
- [x] `majorDecisionPrompt` on consequential commands (v25)

## Site tasks

### 1. Environment

```env
VITE_WORLDMIND_CORE_URL=http://127.0.0.1:8080
```

Production: Cloudflare Worker proxy or direct core subdomain.

### 2. Route

Add `/play` → `WorldMindPlayPortal` component.

### 3. Boot sequence

```typescript
const health = await fetch(`${CORE}/api/health`).then(r => r.json());
if (!health.ok) showOfflineFallback();
const state = await fetch(`${CORE}/api/state`).then(r => r.json());
renderFromGameShell(state.gameShell);
```

### 4. Commands

```typescript
await fetch(`${CORE}/api/command`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text: command })
});
```

Merge `result.gameShell`, `result.playerSnapshot`, and optional `result.majorDecisionPrompt` (branch modal before impact).

### 5. UI options

| Approach | Effort | Notes |
|----------|--------|-------|
| **A. iframe** `core/static-play` | Low | Fastest demo; less branded |
| **B. React shell from `gameShell`** | Medium | Recommended — matches product |
| **C. Full reimplement visual shell** | High | Only if design diverges strongly |

### 6. Offline fallback

- Show `product.ts` demo command strip as read-only
- Link: "Run locally: `git clone worldmind-core && npm run play:server`"
- Optional: embed pre-generated `static-play/index.html` from core release artifact

### 7. Deploy

- Worker on `worldmind.tekup.dk` proxies `/api/*` to core OR
- Site calls core on separate host with CORS (`WM_CORS_ORIGIN`)

### 8. Update `src/data/product.ts`

Replace hardcoded rc8 stats with dynamic health check or version from `/api/health`.

## Verification

```bash
# Terminal 1 (core)
WM_CORS_ORIGIN=http://localhost:5173 npm run play:server

# Terminal 2 (site)
npm run dev
# Open http://localhost:5173/play — state loads, command runs
```

Core-only gates before site work:

```bash
npm run validate:play-api
npm run validate:web-play
npm test
```

## Out of scope (wait for Leno runtime / post-rc.2)

- LLM-powered Leno dialogue (evidence guards and summary policy only today)
- Rich `consequence.evidenceDelta` on every command variant (baseline envelope present; not every path maximally detailed)
- 3D `visualCues` on `gameShell` (contract slot reserved)
- Full founder delivery workflow beyond contract loop
