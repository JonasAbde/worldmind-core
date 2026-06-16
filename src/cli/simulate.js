#!/usr/bin/env node
import path from 'node:path';
import { runSimulation, evaluateWorld } from '../simulation/sim.js';
import { generateDashboard } from '../simulation/dashboard.js';
import { lenoSummarize, lenoSuggestActions } from '../simulation/leno.js';

const args = process.argv.slice(2);
const daysArg = args.indexOf('--days');
const days = daysArg >= 0 ? Number(args[daysArg + 1]) : 7;
const withDashboard = args.includes('--dashboard');
const withAssert = args.includes('--assert');
const world = runSimulation({ days });
const evalResult = evaluateWorld(world);
console.log('WorldMind simulation complete.');
console.log(JSON.stringify(evalResult, null, 2));
console.log('\nLeno summary:\n' + lenoSummarize(world));
console.log('\nLeno suggestions:\n- ' + lenoSuggestActions(world).join('\n- '));
if (withDashboard) {
  const out = generateDashboard(world, path.resolve('static-dashboard'));
  console.log(`\nDashboard written: ${out.htmlPath}`);
}
if (withAssert && !evalResult.passed) {
  console.error('MVP eval failed.');
  process.exit(1);
}
