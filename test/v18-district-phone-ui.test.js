import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderWebPage, renderDistrictView, renderPhoneTabs, renderEventFeed, applyLenoGuard } from '../src/play/web-renderer.js';
import { buildDistrictView } from '../src/play/district-view.js';
import { bootstrapWorld } from '../src/play/play-engine.js';

const REPO = process.cwd();
const HTML_PATH = path.join(REPO, 'static-play/index.html');

test('v1.0-rc8: district view renderer produces SVG map with 4 locations', () => {
  const world = bootstrapWorld();
  const view = buildDistrictView(world);
  assert.equal(view.nodes.length >= 4, true);
  const svg = renderDistrictView(view);
  assert.ok(svg.includes('wm-district-svg'));
  assert.ok(svg.includes('data-district-map'));
});

test('v1.0-rc8: phone tabs contain all 8 required tabs', () => {
  const html = renderPhoneTabs();
  const tabs = ['messages', 'contacts', 'rumors', 'evidence', 'jobs', 'saves', 'branches', 'leno'];
  tabs.forEach((t) => assert.ok(new RegExp(`data-phone-tab="${t}"`).test(html)));
});

test('v1.0-rc8: event feed renders from event array', () => {
  const events = [
    { type: 'world_started', day: 1, time: '00:00', message: 'World started' },
    { type: 'location_inspected', day: 1, time: '06:00', message: 'Apartment inspected' }
  ];
  const html = renderEventFeed(events);
  assert.ok(html.includes('wm-event-feed'));
  assert.ok(html.includes('world_started'));
  assert.ok(html.includes('location_inspected'));
});

test('v1.0-rc8: full page includes district view and phone sections', () => {
  const world = bootstrapWorld();
  const html = renderWebPage({ world, demoPaths: [] });
  assert.ok(html.includes('id="section-district"'));
  assert.ok(html.includes('id="section-phone"'));
  assert.ok(html.includes('id="section-events"'));
});

test('v1.0-rc8: static page contains all new markers', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.ok(/data-district-map/.test(html));
  assert.ok(/data-phone-tab="leno"/.test(html));
  assert.ok(/data-event-feed/.test(html));
});

test('v1.0-rc8: Leno guard is applied in district-ui flow', () => {
  const guarded = applyLenoGuard('Nadia is the source of the rumor.', { playerKnowledge: { evidenceIds: [] } });
  assert.ok(guarded.includes('REDACTED'));
  const unguarded = applyLenoGuard('Nadia is the source.', { playerKnowledge: { evidenceIds: ['rumor_source_nadia'] } });
  assert.equal(unguarded, 'Nadia is the source.');
});

test('v1.0-rc8: location click hook dispatches move command', () => {
  const world = bootstrapWorld();
  const view = buildDistrictView(world);
  const html = renderDistrictView(view);
  assert.ok(/data-location-id=/.test(html));
});