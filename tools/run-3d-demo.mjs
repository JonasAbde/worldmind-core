#!/usr/bin/env node
/**
 * Record a short playable 3D demo as screenshots.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.WM_3D_URL || 'http://127.0.0.1:8080/3d.html';
const OUT = path.resolve('artifacts/demo');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const shots = [];

async function snap(name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  shots.push(file);
}

await snap('01-start.png');

await page.getByRole('button', { name: /Go: Sara/i }).click();
await page.waitForTimeout(1200);
await snap('02-move-cafe.png');

await page.getByRole('button', { name: /Talk sara/i }).click();
await page.waitForTimeout(1200);
await snap('03-talk-sara.png');

await page.getByRole('button', { name: /Ask Leno/i }).click();
await page.waitForTimeout(1200);
await snap('04-ask-leno.png');

await page.getByRole('button', { name: /Go: Market/i }).click();
await page.waitForTimeout(1200);
await snap('05-market.png');

const status = await page.locator('#status').innerText();
const log = await page.locator('#log').innerText();

await browser.close();

console.log(JSON.stringify({ ok: true, url: BASE, status, shots, logPreview: log.slice(0, 800) }, null, 2));
