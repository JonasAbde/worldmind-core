#!/usr/bin/env node
/**
 * verify:production-play — remote Play API smoke test for deployed worldmind-core.
 *
 * Requires WORLDMIND_CORE_URL (e.g. https://core.worldmind.example.com).
 * Checks /api/health, /api/state visualCues v4, and POST move walkAnimation.
 *
 * Usage:
 *   WORLDMIND_CORE_URL=https://core.example.com node src/cli/verify-production-play.js
 */

import { PLAY_API_VERSION } from '../play/play-api-payload.js';
import {
  assertVisualCuesV4,
  assertVisualCuesMesh3d,
  assertWalkAnimation,
  pickMoveTarget
} from '../play/play-api-verify.js';

function baseUrl() {
  const raw = process.env.WORLDMIND_CORE_URL?.trim();
  if (!raw) {
    throw new Error('WORLDMIND_CORE_URL is required');
  }
  return raw.replace(/\/$/, '');
}

async function fetchJson(urlPath, options = {}) {
  const res = await fetch(`${baseUrl()}${urlPath}`, {
    headers: { accept: 'application/json', ...(options.headers || {}) },
    ...options
  });
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`${urlPath} returned non-JSON (status ${res.status})`);
  }
  return { status: res.status, json };
}

async function main() {
  const url = baseUrl();
  try {
    const health = await fetchJson('/api/health');
    if (health.status !== 200 || !health.json.ok) {
      throw new Error(`/api/health failed (status ${health.status})`);
    }
    if (health.json.apiVersion !== PLAY_API_VERSION) {
      throw new Error(`apiVersion mismatch: ${health.json.apiVersion}`);
    }

    const state = await fetchJson('/api/state');
    if (state.status !== 200 || !state.json.ok) {
      throw new Error(`/api/state failed (status ${state.status})`);
    }
    const visualCheck = assertVisualCuesV4(state.json.visualCues);
    if (!visualCheck.ok) {
      throw new Error(`visualCues v4: ${visualCheck.problems.join(', ')}`);
    }
    const mesh3dCheck = assertVisualCuesMesh3d(state.json.visualCues);
    if (!mesh3dCheck.ok) {
      throw new Error(`visualCues mesh3d: ${mesh3dCheck.problems.join(', ')}`);
    }
    const sampleModel = state.json.visualCues.locations?.find((l) => l.modelUrl)?.modelUrl;
    if (sampleModel) {
      const modelPath = sampleModel.startsWith('/') ? sampleModel : `/${sampleModel}`;
      const modelRes = await fetch(`${url}${modelPath}`);
      if (modelRes.status !== 200) {
        throw new Error(`modelUrl fetch failed: ${modelPath} (${modelRes.status})`);
      }
    }

    const { from, to } = pickMoveTarget(state.json);
    if (!from || !to) throw new Error('could not resolve move target');

    const move = await fetchJson('/api/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `move ${to}` })
    });
    if (move.status !== 200 || !move.json.ok) {
      throw new Error(`move command failed: ${move.json.error || move.status}`);
    }
    const walkCheck = assertWalkAnimation(move.json.result?.walkAnimation, from, to);
    if (!walkCheck.ok) {
      throw new Error(`walkAnimation: ${walkCheck.problems.join(', ')}`);
    }

    process.stdout.write(JSON.stringify({
      ok: true,
      kind: 'production-play-verify',
      url,
      apiVersion: PLAY_API_VERSION,
      visualCuesVersion: state.json.visualCues.version,
      moveFrom: from,
      moveTo: to,
      waypointCount: move.json.result.walkAnimation.waypoints.length
    }) + '\n');
    process.exit(0);
  } catch (err) {
    process.stdout.write(JSON.stringify({
      ok: false,
      kind: 'production-play-verify',
      url,
      error: String(err.message || err)
    }) + '\n');
    process.exit(1);
  }
}

main();
