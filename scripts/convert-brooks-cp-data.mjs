#!/usr/bin/env node

/**
 * Convert Brooks CP growth chart data from peditools CSV to JSON LMS tables.
 *
 * Source: https://github.com/jhchou/peditools (MIT code license)
 * Data: Brooks et al., "Low weight, morbidity, and mortality in children with cerebral palsy" (2011)
 * License: Dr. Brooks confirmed free use for educational and commercial purposes (email 2026-02-10)
 *
 * Pinned commit: 450be0147cfc71a3002c2efe746f98601f2c2396
 * Output: 36 JSON files in src/data/
 *         6 GMFCS levels × 3 measures (weight, height, bmi) × 2 sexes = 36 files
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'src', 'data');

// Pinned commit for reproducibility
const COMMIT = '450be0147cfc71a3002c2efe746f98601f2c2396';
const CSV_URL = `https://raw.githubusercontent.com/jhchou/peditools/${COMMIT}/data-raw/charts_long.csv`;

// Mapping: chart name → file prefix
const GMFCS_MAP = {
  brooks_gmfcs_1: 'cp1',
  brooks_gmfcs_2: 'cp2',
  brooks_gmfcs_3: 'cp3',
  brooks_gmfcs_4: 'cp4',
  brooks_gmfcs_5_nt: 'cp5nt',   // GMFCS V oral (non-tube)
  brooks_gmfcs_5_tf: 'cp5tf',   // GMFCS V tube-fed
};

// Mapping: measure → indicator suffix
const MEASURE_MAP = {
  weight: 'wfa',
  height: 'hfa',
  bmi: 'bfa',
};

// Mapping: gender → sex suffix
const SEX_MAP = {
  m: 'boys',
  f: 'girls',
};

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Output directory: ${DATA_DIR}\n`);
  console.log(`Downloading from: ${CSV_URL}\n`);

  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status} ${res.statusText}`);
  const text = await res.text();

  // Parse CSV
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i]; });
    return row;
  });

  // Filter to Brooks GMFCS data only
  const brooksRows = rows.filter(r => r.chart.startsWith('brooks_gmfcs_'));

  console.log(`Total CSV rows: ${rows.length}`);
  console.log(`Brooks CP rows: ${brooksRows.length}\n`);

  // Group by chart × gender × measure → file
  const groups = new Map();

  for (const row of brooksRows) {
    const prefix = GMFCS_MAP[row.chart];
    const indicator = MEASURE_MAP[row.measure];
    const sex = SEX_MAP[row.gender];

    if (!prefix || !indicator || !sex) {
      console.warn(`  ⚠ Skipping unknown: chart=${row.chart} measure=${row.measure} gender=${row.gender}`);
      continue;
    }

    const filename = `${prefix}-${indicator}-${sex}.json`;

    if (!groups.has(filename)) {
      groups.set(filename, []);
    }

    // Convert age from decimal years to days (years × 365.25, rounded)
    const ageYears = parseFloat(row.age);
    const ageDays = Math.round(ageYears * 365.25);

    groups.get(filename).push({
      age: ageDays,
      L: parseFloat(parseFloat(row.L).toFixed(6)),
      M: parseFloat(parseFloat(row.M).toFixed(6)),
      S: parseFloat(parseFloat(row.S).toFixed(6)),
    });
  }

  // Sort each group by age and write
  let totalFiles = 0;

  // Sort filenames for consistent output
  const sortedFilenames = [...groups.keys()].sort();

  for (const filename of sortedFilenames) {
    const data = groups.get(filename);
    data.sort((a, b) => a.age - b.age);

    const outPath = resolve(DATA_DIR, filename);
    const json = JSON.stringify(data, null, 2) + '\n';
    writeFileSync(outPath, json);

    const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(1);
    console.log(`  ✓ ${filename.padEnd(25)} ${String(data.length).padStart(3)} rows  (${sizeKB} KB)`);
    totalFiles++;
  }

  console.log(`\nDone! Generated ${totalFiles} JSON files.\n`);

  // Validation
  console.log('── Validation ──');
  let ok = true;

  if (totalFiles !== 36) {
    console.error(`  ✗ Expected 36 files, got ${totalFiles}`);
    ok = false;
  } else {
    console.log(`  ✓ File count: ${totalFiles} (expected 36)`);
  }

  // Each file should have 37 rows (2.0 to 20.0 in 0.5y increments)
  for (const filename of sortedFilenames) {
    const data = groups.get(filename);
    if (data.length !== 37) {
      console.error(`  ✗ ${filename}: expected 37 rows, got ${data.length}`);
      ok = false;
    }
  }

  if (ok) {
    console.log('  ✓ All files have 37 rows each');
  }

  // Check age range: first row ~731 days (2y), last row ~7305 days (20y)
  for (const filename of sortedFilenames) {
    const data = groups.get(filename);
    const firstAge = data[0].age;
    const lastAge = data[data.length - 1].age;
    if (firstAge !== 731 || lastAge !== 7305) {
      console.error(`  ✗ ${filename}: age range ${firstAge}-${lastAge}, expected 731-7305`);
      ok = false;
    }
  }

  if (ok) {
    console.log('  ✓ Age range: 731-7305 days (2-20 years)');
    console.log('\nAll validations passed!');
  } else {
    console.error('\nSome validations failed!');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
