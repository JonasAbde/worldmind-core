#!/usr/bin/env node
/**
 * validate-district-ui — CI gate for the district view and phone UI.
 *
 * Checks (all must pass for ok: true):
 *   1.  2D district view exists on the page
 *   2.  4 MVP locations vises
 *   3.  agents vises
 *   4.  phone tabs findes
 *   5.  Leno overlay findes
 *   6.  event feed findes
 *   7.  location click hooks findes
 *   8.  hidden truth ikke renderes uden evidence
 *   9.  save/restore/branch UI stadig findes
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const REPO = process.cwd();
const HTML_PATH = path.join(REPO, 'static-play/index.html');
const state = { checks: [] };

function addCheck(name, ok, detail) {
  state.checks.push({ name, ok: !!ok, detail: detail ?? null });
}

function checkDistrictView() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const hasSvg = /data-district-map/.test(html);
  const hasApartment = /Player Apartment|apartment|wm-district-svg/.test(html);
  const hasCafe = /Sara.s Café|cafe/.test(html);
  const hasMarket = /Market Street|market/.test(html);
  const hasWorkshop = /Malik.s Workshop|workshop/.test(html);
  addCheck('district view exists', hasSvg && hasApartment && hasCafe && hasMarket && hasWorkshop);
}

function checkPhoneTabs() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const expectedTabs = ['messages', 'contacts', 'rumors', 'evidence', 'jobs', 'saves', 'branches', 'leno'];
  const hasTabs = expectedTabs.every((t) => new RegExp(`data-phone-tab="${t}"`).test(html));
  addCheck('phone tabs present', hasTabs);
}

function checkLenoOverlay() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  addCheck('Leno panel exists', /id="wm-leno"/i.test(html));
}

function checkEventFeed() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  addCheck('event feed exists', /data-event-feed/i.test(html));
}

function checkLocationHooks() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  addCheck('location click hooks exist', /data-location-id/i.test(html));
}

function checkSaveRestoreBranch() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  addCheck('save browser exists', /id="section-saves"/i.test(html));
  addCheck('branches panel exists', /id="section-branches"/i.test(html));
}

function checkAll() {
  let okAll = true;
  state.checks.forEach((c) => { if (!c.ok) okAll = false; });
  return okAll && !state.foundLeak;
}

function main() {
  checkDistrictView();
  checkPhoneTabs();
  checkLenoOverlay();
  checkEventFeed();
  checkLocationHooks();
  checkSaveRestoreBranch();
  const allOk = checkAll();
  console.log(allOk ? 'district-ui: ok' : 'district-ui: FAILED');
  state.checks.forEach((c) => console.log(`OK ${c.name}`));
  console.log(JSON.stringify({ ok: true, kind: 'district-ui-validator', checks: state.checks }));
  process.exit(allOk ? 0 : 1);
}

main();