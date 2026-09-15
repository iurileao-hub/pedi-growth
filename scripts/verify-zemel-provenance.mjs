#!/usr/bin/env node

/**
 * Verify the provenance of the Down syndrome (Zemel 2015) LMS tables.
 *
 * Unlike the WHO and Brooks tables, the Zemel data cannot be regenerated from a
 * single upstream source: it has two origins, and one of them is a published
 * erratum that exists only on paper. So this script verifies rather than generates.
 *
 *   - 421 of 458 points come from peditools (pinned commit below) and must match
 *     it exactly.
 *   - 37 points — boys' head circumference from age 2 — come from the official
 *     erratum to Zemel 2015, Supplemental Table 18, which corrected errors in the
 *     published L, M, S parameters. peditools does not carry the erratum, so these
 *     points are EXPECTED to diverge. Divergence here is the correct outcome;
 *     agreement would mean the erratum had been lost.
 *
 * Exits non-zero if the split differs from the documented one, so that a silent
 * edit to src/data/ds-*.json cannot pass unnoticed.
 *
 * Source: Zemel BS et al., Pediatrics 2015;136(5):e1204-e1211 (+ erratum)
 * See NOTICE.md §3 for the rights covering this data.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'src', 'data');

const COMMIT = '450be0147cfc71a3002c2efe746f98601f2c2396';
const CSV_URL = `https://raw.githubusercontent.com/jhchou/peditools/${COMMIT}/data-raw/charts_long.csv`;

const DAYS_PER_MONTH = 30.4375;
const DAYS_PER_YEAR = 365.25;

// indicator prefix -> peditools measure names (infant and pedi charts differ)
const MEASURES = {
  wfa: ['weight'],
  lhfa: ['length', 'height'],
  bfa: ['bmi'],
  hcfa: ['head_circ'],
};

// The documented erratum region: boys' head circumference from 2 years on.
const ERRATUM = { indicator: 'hcfa', sex: 'boys', minDays: 730 };
const EXPECTED_ERRATUM_POINTS = 37;

async function fetchPeditools() {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`peditools fetch failed: ${res.status}`);
  // peditools ships CRLF; without this the last column parses as 'S\r' and every S becomes NaN
  const text = (await res.text()).replace(/\r/g, '');
  const [header, ...lines] = text.trim().split('\n');
  const cols = header.split(',');
  const idx = Object.fromEntries(cols.map((c, i) => [c, i]));

  // (gender, measure) -> Map<days, [L, M, S][]>
  const table = new Map();
  for (const line of lines) {
    const f = line.split(',');
    if (!f[idx.chart].startsWith('zemel')) continue;
    const age = Number(f[idx.age]);
    const days = roundHalfEven(age * (f[idx.age_units] === 'months' ? DAYS_PER_MONTH : DAYS_PER_YEAR));
    const key = `${f[idx.gender]}|${f[idx.measure]}`;
    if (!table.has(key)) table.set(key, new Map());
    const byDay = table.get(key);
    if (!byDay.has(days)) byDay.set(days, []);
    byDay.get(days).push([Number(f[idx.L]), Number(f[idx.M]), Number(f[idx.S])]);
  }
  return table;
}

const near = (a, b) => Math.abs(a - b) < 1e-9;

/**
 * Round half to even, matching IEEE 754 and Python's round().
 *
 * The committed tables were generated with that convention, so 2, 10 and 18 years
 * (730.5, 3652.5 and 6574.5 days) sit at 730, 3652 and 6574. JavaScript's
 * Math.round rounds half away from zero and would look for 731, 3653 and 6575,
 * missing 21 real points.
 */
function roundHalfEven(x) {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff !== 0.5) return Math.round(x);
  return floor % 2 === 0 ? floor : floor + 1;
}

async function main() {
  const upstream = await fetchPeditools();
  let matched = 0;
  const unmatched = [];

  for (const [indicator, measures] of Object.entries(MEASURES)) {
    for (const [sex, gender] of [['boys', 'm'], ['girls', 'f']]) {
      const file = `ds-${indicator}-${sex}-0-18.json`;
      const rows = JSON.parse(readFileSync(resolve(DATA_DIR, file), 'utf8'));

      // pool every candidate LMS triple upstream offers for each age
      const pool = new Map();
      for (const m of measures) {
        for (const [days, triples] of upstream.get(`${gender}|${m}`) ?? []) {
          if (!pool.has(days)) pool.set(days, []);
          pool.get(days).push(...triples);
        }
      }

      for (const row of rows) {
        const hit = (pool.get(row.age) ?? []).some(
          ([L, M, S]) => near(L, row.L) && near(M, row.M) && near(S, row.S),
        );
        if (hit) matched++;
        else unmatched.push({ file, indicator, sex, age: row.age });
      }
    }
  }

  const strays = unmatched.filter(
    (u) => !(u.indicator === ERRATUM.indicator && u.sex === ERRATUM.sex && u.age >= ERRATUM.minDays),
  );

  console.log(`peditools @ ${COMMIT.slice(0, 7)}`);
  console.log(`  ${matched} points match peditools exactly`);
  console.log(`  ${unmatched.length} points diverge (expected: ${EXPECTED_ERRATUM_POINTS}, from the erratum)`);

  if (strays.length > 0) {
    console.error(`\nFAIL: ${strays.length} point(s) match neither peditools nor the documented erratum region:`);
    for (const s of strays.slice(0, 10)) console.error(`  ${s.file} @ ${s.age} days`);
    process.exit(1);
  }
  if (unmatched.length !== EXPECTED_ERRATUM_POINTS) {
    console.error(`\nFAIL: erratum region has ${unmatched.length} points, expected ${EXPECTED_ERRATUM_POINTS}.`);
    process.exit(1);
  }
  console.log('\nOK: provenance matches NOTICE.md §3.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
