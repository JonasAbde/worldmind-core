// v1.0-rc13 — Episode selector UI tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderEpisodeSelector,
  episodeSelectorAssets,
  injectEpisodeSelectorInto
} from '../src/play/episode-selector.js';

test('renderEpisodeSelector returns the selector HTML shell', () => {
  const html = renderEpisodeSelector();
  assert.match(html, /wm-episode-selector/);
  assert.match(html, /Choose your episode/);
  assert.match(html, /wm-episode-list/);
});

test('episodeSelectorAssets returns CSS + JS', () => {
  const { css, js } = episodeSelectorAssets();
  assert.ok(css.includes('.wm-episode-selector'));
  assert.ok(css.includes('.wm-episode-card'));
  assert.ok(js.includes('/api/episodes'));
  assert.ok(js.includes('/api/episode/switch'));
});

test('injectEpisodeSelectorInto adds the selector HTML, CSS, and JS once', () => {
  const original = `<!DOCTYPE html>
<html><head><title>Test</title></head>
<body>
<header class="wm-header"></header>
<main>content</main>
</body></html>`;
  const result = injectEpisodeSelectorInto(original);
  assert.match(result, /wm-episode-selector/);
  assert.match(result, /Choose your episode/);
  // CSS injected (with optional marker comment)
  assert.match(result, /<style>\s*(?:\/\*\s*wm-episode-selector-marker-css\s*\*\/\s*)?\.wm-episode-selector/);
  // JS injected
  assert.match(result, /<script>\s*(?:\/\*\s*wm-episode-selector-marker-js\s*\*\/\s*)?\(function\(\)/);
});

test('injectEpisodeSelectorInto does not duplicate if already injected', () => {
  const once = injectEpisodeSelectorInto('<!DOCTYPE html><html><head></head><body><header></header></body></html>');
  const twice = injectEpisodeSelectorInto(once);
  const count = (twice.match(/<aside class="wm-episode-selector">/g) || []).length;
  assert.equal(count, 1, 'selector aside should appear exactly once');
});

test('injectEpisodeSelectorInto injects CSS only once', () => {
  const once = injectEpisodeSelectorInto('<!DOCTYPE html><html><head></head><body><header></header></body></html>');
  const twice = injectEpisodeSelectorInto(once);
  // Count unique <style> blocks containing wm-episode-selector CSS.
  const cssCount = (twice.match(/<style>[\s\S]*?\.wm-episode-selector\s*\{[\s\S]*?<\/style>/g) || []).length;
  assert.equal(cssCount, 1, 'CSS block should appear exactly once');
});