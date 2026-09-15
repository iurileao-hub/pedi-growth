#!/usr/bin/env node
/**
 * Smoke test of the BUILT package under plain Node.js ESM.
 *
 * The vitest suite cannot catch what this catches. It runs on Vite, which resolves
 * `import('./x.json')` itself before Node ever sees it; Node's own ESM loader refuses
 * that import without `with { type: 'json' }`. Version 1.1.1 shipped with all 62 data
 * imports missing the attribute: 194 tests green, and the package threw
 * ERR_IMPORT_ATTRIBUTE_MISSING on the first z-score for anyone consuming it from Node.
 *
 * So this exercises dist/ the way an installed consumer does, and touches every chart
 * set, because each one loads a different set of JSON tables.
 *
 * Usage: npm run build && node scripts/smoke-node.mjs
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const entry = join(root, 'dist', 'index.js');

if (!existsSync(entry)) {
  console.error('dist/ not built. Run `npm run build` first.');
  process.exit(1);
}

const { calculateZScore } = await import(entry);

const cases = [
  { name: 'WHO 0-5y   weight-for-age',
    input: { indicator: 'weight-for-age', sex: 'male', ageInDays: 1825, measurement: 18, chartSet: 'who-standard' } },
  { name: 'WHO 5-19y  bmi-for-age',
    input: { indicator: 'bmi-for-age', sex: 'female', ageInDays: 3652, measurement: 16.5, chartSet: 'who-standard' } },
  { name: 'Down synd. length-height-for-age',
    input: { indicator: 'length-height-for-age', sex: 'male', ageInDays: 1825, measurement: 100, chartSet: 'down-syndrome' } },
  { name: 'Cerebral palsy weight-for-age (GMFCS I)',
    input: { indicator: 'weight-for-age', sex: 'male', ageInDays: 2555, measurement: 20, chartSet: 'cerebral-palsy', gmfcsLevel: 1 } },
];

let failed = 0;
for (const { name, input } of cases) {
  try {
    const r = await calculateZScore(input);
    if (!r || !Number.isFinite(r.zScore)) {
      console.error(`FAIL ${name}: got ${JSON.stringify(r)}`);
      failed++;
    } else {
      console.log(`OK   ${name.padEnd(40)} z=${r.zScore}`);
    }
  } catch (err) {
    console.error(`FAIL ${name}: ${err.code || err.message}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} case(s) failed under plain Node ESM.`);
  process.exit(1);
}
console.log('\nOK: the built package loads and computes under plain Node ESM.');
