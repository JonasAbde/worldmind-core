#!/usr/bin/env node
/**
 * Headless browser smoke test for static-play/3d.html
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.WM_3D_URL || 'http://127.0.0.1:8091/3d.html';
const OUT = path.resolve('artifacts/3d-smoke');

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);

const status = await page.locator('#status').innerText();
const mode = await page.locator('#mode').innerText();
await page.screenshot({ path: path.join(OUT, '01-loaded.png'), fullPage: false });

// Click canvas center to select something in 3D scene
const canvas = page.locator('#viewport');
const box = await canvas.boundingBox();
if (box) {
  await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.45);
  await page.waitForTimeout(800);
}
await page.screenshot({ path: path.join(OUT, '02-after-click.png'), fullPage: false });

// Try Ask Leno button
const lenoBtn = page.getByRole('button', { name: 'Ask Leno' });
if (await lenoBtn.count()) {
  await lenoBtn.click();
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: path.join(OUT, '03-after-leno.png'), fullPage: false });

const log = await page.locator('#log').innerText();
const actions = await page.locator('#actions button').allTextContents();

await browser.close();

const report = {
  url: BASE,
  status,
  mode,
  actionButtons: actions,
  logPreview: log.slice(0, 500),
  consoleErrors,
  screenshots: [
    'artifacts/3d-smoke/01-loaded.png',
    'artifacts/3d-smoke/02-after-click.png',
    'artifacts/3d-smoke/03-after-leno.png'
  ],
  ok: status.toLowerCase().includes('connected') && consoleErrors.length === 0
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
