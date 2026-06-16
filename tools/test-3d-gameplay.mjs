#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.WM_3D_URL || 'http://127.0.0.1:8091/3d.html';
const OUT = path.resolve('artifacts/3d-smoke');

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const canvas = page.locator('#viewport');
const box = await canvas.boundingBox();

// Click Sara's Cafe tile area (upper-left of scene)
await page.mouse.click(box.x + box.width * 0.38, box.y + box.height * 0.32);
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, '04-cafe-selected.png') });

const moveBtn = page.getByRole('button', { name: /Go: Sara/i });
if (await moveBtn.count()) {
  await moveBtn.click();
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: path.join(OUT, '05-moved-to-cafe.png') });

const talkBtn = page.getByRole('button', { name: /Talk sara/i });
if (await talkBtn.count()) {
  await talkBtn.click();
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: path.join(OUT, '06-talk-npc.png') });

const status = await page.locator('#status').innerText();
const log = await page.locator('#log').innerText();
const buttons = await page.locator('#actions button').allTextContents();

await browser.close();

const report = {
  status,
  buttons,
  logTail: log.split('\n').slice(0, 8),
  ok: /Connected to play API/.test(status) && /move cafe|talk sara|Command executed|Sara/i.test(log)
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
