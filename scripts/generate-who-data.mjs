#!/usr/bin/env node

/**
 * Generate WHO Child Growth Standards LMS data as JSON files.
 *
 * Sources:
 *   - 0-5 years: https://github.com/WorldHealthOrganization/anthro (data-raw/growthstandards/)
 *   - 5-19 years: https://github.com/WorldHealthOrganization/anthroplus (data-raw/growthstandards/)
 *
 * Output: 18 JSON files in packages/pedi-growth/src/data/
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'src', 'data');

// ── WHO anthro (0-5 years) raw URLs ──
const ANTHRO_BASE =
  'https://raw.githubusercontent.com/WorldHealthOrganization/anthro/master/data-raw/growthstandards';

// ── WHO anthroplus (5-19 years) raw URLs ──
const ANTHROPLUS_BASE =
  'https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/main/data-raw/growthstandards';

// sex mapping: WHO uses 1=boys, 2=girls
const BOYS = 1;
const GIRLS = 2;

// ── Table definitions ──

/**
 * @typedef {Object} TableDef
 * @property {string} url - Remote TSV URL
 * @property {number} sex - 1=boys, 2=girls
 * @property {string} keyColumn - column to use as "age" (age, length, height)
 * @property {string} outFile - output JSON filename
 * @property {[number,number]|null} ageRange - optional inclusive age filter [min, max]
 */

/** @type {TableDef[]} */
const TABLES = [
  // ── Weight-for-age 0-5 (by day, 0-1856) ──
  { url: `${ANTHRO_BASE}/weianthro.txt`, sex: BOYS, keyColumn: 'age', outFile: 'wfa-boys-0-5.json', ageRange: null },
  { url: `${ANTHRO_BASE}/weianthro.txt`, sex: GIRLS, keyColumn: 'age', outFile: 'wfa-girls-0-5.json', ageRange: null },

  // ── Length/height-for-age 0-5 (by day) ──
  { url: `${ANTHRO_BASE}/lenanthro.txt`, sex: BOYS, keyColumn: 'age', outFile: 'lhfa-boys-0-5.json', ageRange: null },
  { url: `${ANTHRO_BASE}/lenanthro.txt`, sex: GIRLS, keyColumn: 'age', outFile: 'lhfa-girls-0-5.json', ageRange: null },

  // ── BMI-for-age 0-5 (by day) ──
  { url: `${ANTHRO_BASE}/bmianthro.txt`, sex: BOYS, keyColumn: 'age', outFile: 'bfa-boys-0-5.json', ageRange: null },
  { url: `${ANTHRO_BASE}/bmianthro.txt`, sex: GIRLS, keyColumn: 'age', outFile: 'bfa-girls-0-5.json', ageRange: null },

  // ── Head circumference-for-age 0-5 (by day) ──
  { url: `${ANTHRO_BASE}/hcanthro.txt`, sex: BOYS, keyColumn: 'age', outFile: 'hcfa-boys-0-5.json', ageRange: null },
  { url: `${ANTHRO_BASE}/hcanthro.txt`, sex: GIRLS, keyColumn: 'age', outFile: 'hcfa-girls-0-5.json', ageRange: null },

  // ── Weight-for-length (by 0.1 cm, 45-110) ──
  { url: `${ANTHRO_BASE}/wflanthro.txt`, sex: BOYS, keyColumn: 'length', outFile: 'wfl-boys.json', ageRange: null },
  { url: `${ANTHRO_BASE}/wflanthro.txt`, sex: GIRLS, keyColumn: 'length', outFile: 'wfl-girls.json', ageRange: null },

  // ── Weight-for-height (by 0.1 cm, 65-120) ──
  { url: `${ANTHRO_BASE}/wfhanthro.txt`, sex: BOYS, keyColumn: 'height', outFile: 'wfh-boys.json', ageRange: null },
  { url: `${ANTHRO_BASE}/wfhanthro.txt`, sex: GIRLS, keyColumn: 'height', outFile: 'wfh-girls.json', ageRange: null },

  // ── Weight-for-age 5-10 (by month, 61-120) ──
  { url: `${ANTHROPLUS_BASE}/wfawho2007.txt`, sex: BOYS, keyColumn: 'age', outFile: 'wfa-boys-5-10.json', ageRange: [61, 120] },
  { url: `${ANTHROPLUS_BASE}/wfawho2007.txt`, sex: GIRLS, keyColumn: 'age', outFile: 'wfa-girls-5-10.json', ageRange: [61, 120] },

  // ── Height-for-age 5-19 (by month, 61-228) ──
  { url: `${ANTHROPLUS_BASE}/hfawho2007.txt`, sex: BOYS, keyColumn: 'age', outFile: 'hfa-boys-5-19.json', ageRange: [61, 228] },
  { url: `${ANTHROPLUS_BASE}/hfawho2007.txt`, sex: GIRLS, keyColumn: 'age', outFile: 'hfa-girls-5-19.json', ageRange: [61, 228] },

  // ── BMI-for-age 5-19 (by month, 61-228) ──
  { url: `${ANTHROPLUS_BASE}/bfawho2007.txt`, sex: BOYS, keyColumn: 'age', outFile: 'bfa-boys-5-19.json', ageRange: [61, 228] },
  { url: `${ANTHROPLUS_BASE}/bfawho2007.txt`, sex: GIRLS, keyColumn: 'age', outFile: 'bfa-girls-5-19.json', ageRange: [61, 228] },
];

// ── Helpers ──

/**
 * Fetch a TSV file and parse it into rows.
 * Caches fetched content to avoid duplicate downloads.
 * @type {Map<string, string>}
 */
const fetchCache = new Map();

async function fetchTsv(url) {
  if (fetchCache.has(url)) return fetchCache.get(url);
  console.log(`  Downloading ${url.split('/').pop()}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  const text = await res.text();
  fetchCache.set(url, text);
  return text;
}

/**
 * Parse TSV text into an array of objects with string keys.
 */
function parseTsv(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split('\t').map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i];
    });
    return row;
  });
}

/**
 * Filter and map rows into LmsRow format.
 */
function extractLmsRows(rows, sex, keyColumn, ageRange) {
  return rows
    .filter(row => Number(row.sex) === sex)
    .filter(row => {
      if (!ageRange) return true;
      const val = Number(row[keyColumn]);
      return val >= ageRange[0] && val <= ageRange[1];
    })
    .map(row => ({
      age: Number(row[keyColumn]),
      L: Number(row.l),
      M: Number(row.m),
      S: Number(row.s),
    }));
}

// ── Main ──

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Output directory: ${DATA_DIR}\n`);

  let totalFiles = 0;

  for (const table of TABLES) {
    const { url, sex, keyColumn, outFile, ageRange } = table;
    const sexLabel = sex === BOYS ? 'boys' : 'girls';

    const text = await fetchTsv(url);
    const rows = parseTsv(text);
    const lmsRows = extractLmsRows(rows, sex, keyColumn, ageRange);

    const outPath = resolve(DATA_DIR, outFile);
    writeFileSync(outPath, JSON.stringify(lmsRows, null, 2) + '\n');

    const sizeKB = (Buffer.byteLength(JSON.stringify(lmsRows, null, 2)) / 1024).toFixed(1);
    console.log(`  ✓ ${outFile.padEnd(25)} ${String(lmsRows.length).padStart(5)} rows  (${sizeKB} KB)  [${sexLabel}]`);
    totalFiles++;
  }

  console.log(`\nDone! Generated ${totalFiles} JSON files.\n`);

  // Validation
  console.log('── Validation ──');
  let ok = true;
  const expectations = {
    'wfa-boys-0-5.json': { minRows: 1827, maxRows: 1857 },
    'wfa-girls-0-5.json': { minRows: 1827, maxRows: 1857 },
    'lhfa-boys-0-5.json': { minRows: 1827, maxRows: 1857 },
    'lhfa-girls-0-5.json': { minRows: 1827, maxRows: 1857 },
    'bfa-boys-0-5.json': { minRows: 1827, maxRows: 1857 },
    'bfa-girls-0-5.json': { minRows: 1827, maxRows: 1857 },
    'hcfa-boys-0-5.json': { minRows: 1827, maxRows: 1857 },
    'hcfa-girls-0-5.json': { minRows: 1827, maxRows: 1857 },
    'wfl-boys.json': { minRows: 600, maxRows: 700 },
    'wfl-girls.json': { minRows: 600, maxRows: 700 },
    'wfh-boys.json': { minRows: 500, maxRows: 600 },
    'wfh-girls.json': { minRows: 500, maxRows: 600 },
    'wfa-boys-5-10.json': { minRows: 50, maxRows: 70 },
    'wfa-girls-5-10.json': { minRows: 50, maxRows: 70 },
    'hfa-boys-5-19.json': { minRows: 160, maxRows: 175 },
    'hfa-girls-5-19.json': { minRows: 160, maxRows: 175 },
    'bfa-boys-5-19.json': { minRows: 160, maxRows: 175 },
    'bfa-girls-5-19.json': { minRows: 160, maxRows: 175 },
  };

  for (const [file, { minRows, maxRows }] of Object.entries(expectations)) {
    const table = TABLES.find(t => t.outFile === file);
    if (!table) continue;
    const text = await fetchTsv(table.url);
    const rows = parseTsv(text);
    const lmsRows = extractLmsRows(rows, table.sex, table.keyColumn, table.ageRange);
    if (lmsRows.length < minRows || lmsRows.length > maxRows) {
      console.log(`  ✗ ${file}: expected ${minRows}-${maxRows} rows, got ${lmsRows.length}`);
      ok = false;
    } else {
      console.log(`  ✓ ${file}: ${lmsRows.length} rows OK`);
    }
  }

  if (!ok) {
    console.error('\nSome validations failed!');
    process.exit(1);
  }

  console.log('\nAll validations passed!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
