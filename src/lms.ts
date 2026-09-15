import type { LmsRow, Sex, Indicator, ChartSet, GmfcsLevel } from './types.js';
import { loadTable } from './data/index.js';

/**
 * Interpolate LMS values between two adjacent rows.
 * Linear interpolation is applied independently to L, M, and S.
 */
function interpolateLms(lower: LmsRow, upper: LmsRow, fraction: number): LmsRow {
  return {
    age: lower.age + (upper.age - lower.age) * fraction,
    L: lower.L + (upper.L - lower.L) * fraction,
    M: lower.M + (upper.M - lower.M) * fraction,
    S: lower.S + (upper.S - lower.S) * fraction,
  };
}

/**
 * Look up LMS values for a given index (age in days/months or length/height in cm).
 * Uses binary search + linear interpolation between adjacent points.
 *
 * Returns null if the index is out of the table's range.
 */
export function lookupLms(table: LmsRow[], index: number): LmsRow | null {
  if (table.length === 0) return null;

  const first = table[0];
  const last = table[table.length - 1];

  // Out of range
  if (index < first.age || index > last.age) return null;

  // Exact match on first or last
  if (index === first.age) return first;
  if (index === last.age) return last;

  // Binary search for the bracket
  let lo = 0;
  let hi = table.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (table[mid].age === index) return table[mid];
    if (table[mid].age < index) lo = mid + 1;
    else hi = mid - 1;
  }

  // lo is now the index of the first element > index
  // hi is the index of the last element < index
  const lower = table[hi];
  const upper = table[lo];

  if (lower.age === upper.age) return lower;

  const fraction = (index - lower.age) / (upper.age - lower.age);
  return interpolateLms(lower, upper, fraction);
}

/**
 * Determine which table to load and what index to use for an indicator.
 * Returns the table key and the age/measurement index.
 */
interface TableLookupParams {
  indicator: Indicator;
  sex: Sex;
  ageInDays?: number;
  lengthHeight?: number;
  chartSet?: ChartSet;
  gmfcsLevel?: GmfcsLevel;
}

interface ResolvedTable {
  table: LmsRow[];
  index: number;
}

/**
 * Age in days to months (for 5-19 year tables that use months).
 */
function daysToMonths(days: number): number {
  return days / 30.4375;
}

/**
 * Load and resolve the appropriate LMS table + index for a given indicator.
 * Dispatches to the correct chart set (WHO, Down syndrome, or cerebral palsy).
 */
export async function resolveTable(params: TableLookupParams): Promise<ResolvedTable | null> {
  const chartSet = params.chartSet ?? 'who-standard';

  switch (chartSet) {
    case 'who-standard':
      return resolveWhoTable(params);
    case 'down-syndrome':
      return resolveDownSyndromeTable(params);
    case 'cerebral-palsy':
      return resolveCerebralPalsyTable(params);
    default:
      return null;
  }
}

async function resolveWhoTable(params: TableLookupParams): Promise<ResolvedTable | null> {
  const { indicator, sex, ageInDays, lengthHeight } = params;
  const sexKey = sex === 'male' ? 'boys' : 'girls';

  switch (indicator) {
    case 'weight-for-age': {
      if (ageInDays == null) return null;
      if (ageInDays <= 1856) {
        const table = await loadTable(`wfa-${sexKey}-0-5`);
        return { table, index: ageInDays };
      }
      // 5-10 years: use months
      const months = daysToMonths(ageInDays);
      if (months > 120) return null; // max 10 years
      const table = await loadTable(`wfa-${sexKey}-5-10`);
      return { table, index: months };
    }

    case 'length-height-for-age': {
      if (ageInDays == null) return null;
      if (ageInDays <= 1856) {
        const table = await loadTable(`lhfa-${sexKey}-0-5`);
        return { table, index: ageInDays };
      }
      const months = daysToMonths(ageInDays);
      if (months > 228) return null; // max 19 years
      const table = await loadTable(`hfa-${sexKey}-5-19`);
      return { table, index: months };
    }

    case 'bmi-for-age': {
      if (ageInDays == null) return null;
      if (ageInDays <= 1856) {
        const table = await loadTable(`bfa-${sexKey}-0-5`);
        return { table, index: ageInDays };
      }
      const months = daysToMonths(ageInDays);
      if (months > 228) return null; // max 19 years
      const table = await loadTable(`bfa-${sexKey}-5-19`);
      return { table, index: months };
    }

    case 'head-circumference-for-age': {
      if (ageInDays == null) return null;
      if (ageInDays > 1856) return null; // HC only for 0-5 years
      const table = await loadTable(`hcfa-${sexKey}-0-5`);
      return { table, index: ageInDays };
    }

    case 'weight-for-length': {
      if (lengthHeight == null) return null;
      const table = await loadTable(`wfl-${sexKey}`);
      return { table, index: lengthHeight };
    }

    case 'weight-for-height': {
      if (lengthHeight == null) return null;
      const table = await loadTable(`wfh-${sexKey}`);
      return { table, index: lengthHeight };
    }

    default:
      return null;
  }
}

async function resolveDownSyndromeTable(params: TableLookupParams): Promise<ResolvedTable | null> {
  const { indicator, sex, ageInDays } = params;
  if (ageInDays == null) return null;
  const sexKey = sex === 'male' ? 'boys' : 'girls';

  switch (indicator) {
    case 'weight-for-age': {
      const table = await loadTable(`ds-wfa-${sexKey}-0-18`);
      return { table, index: ageInDays };
    }
    case 'length-height-for-age': {
      const table = await loadTable(`ds-lhfa-${sexKey}-0-18`);
      return { table, index: ageInDays };
    }
    case 'bmi-for-age': {
      const table = await loadTable(`ds-bfa-${sexKey}-0-18`);
      return { table, index: ageInDays };
    }
    case 'head-circumference-for-age': {
      const table = await loadTable(`ds-hcfa-${sexKey}-0-18`);
      return { table, index: ageInDays };
    }
    // Down syndrome does not have weight-for-length or weight-for-height
    default:
      return null;
  }
}

/** Map GMFCS level to file prefix */
const GMFCS_PREFIX: Record<string, string> = {
  '1': 'cp1',
  '2': 'cp2',
  '3': 'cp3',
  '4': 'cp4',
  '5-oral': 'cp5nt',
  '5-tube': 'cp5tf',
};

async function resolveCerebralPalsyTable(params: TableLookupParams): Promise<ResolvedTable | null> {
  const { indicator, sex, ageInDays, gmfcsLevel } = params;
  if (ageInDays == null || gmfcsLevel == null) return null;

  const prefix = GMFCS_PREFIX[String(gmfcsLevel)];
  if (!prefix) return null;

  const sexKey = sex === 'male' ? 'boys' : 'girls';

  const indicatorKey: Record<string, string> = {
    'weight-for-age': 'wfa',
    'length-height-for-age': 'hfa',
    'bmi-for-age': 'bfa',
  };
  const key = indicatorKey[indicator];
  if (!key) return null; // CP does not have HC, weight-for-length, or weight-for-height

  const tableName = `${prefix}-${key}-${sexKey}` as Parameters<typeof loadTable>[0];
  const table = await loadTable(tableName);
  return { table, index: ageInDays };
}
