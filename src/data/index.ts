import type { LmsRow } from '../types.js';

/** Table name to file mapping */
type TableName =
  | 'wfa-boys-0-5'
  | 'wfa-girls-0-5'
  | 'lhfa-boys-0-5'
  | 'lhfa-girls-0-5'
  | 'bfa-boys-0-5'
  | 'bfa-girls-0-5'
  | 'hcfa-boys-0-5'
  | 'hcfa-girls-0-5'
  | 'wfa-boys-5-10'
  | 'wfa-girls-5-10'
  | 'hfa-boys-5-19'
  | 'hfa-girls-5-19'
  | 'bfa-boys-5-19'
  | 'bfa-girls-5-19'
  | 'wfl-boys'
  | 'wfl-girls'
  | 'wfh-boys'
  | 'wfh-girls'
  // Down syndrome (CDC/Zemel 2015)
  | 'ds-wfa-boys-0-18'
  | 'ds-wfa-girls-0-18'
  | 'ds-lhfa-boys-0-18'
  | 'ds-lhfa-girls-0-18'
  | 'ds-bfa-boys-0-18'
  | 'ds-bfa-girls-0-18'
  | 'ds-hcfa-boys-0-18'
  | 'ds-hcfa-girls-0-18'
  // Cerebral palsy (Brooks 2011) — 6 GMFCS levels × 3 measures × 2 sexes
  | 'cp1-wfa-boys'
  | 'cp1-wfa-girls'
  | 'cp1-hfa-boys'
  | 'cp1-hfa-girls'
  | 'cp1-bfa-boys'
  | 'cp1-bfa-girls'
  | 'cp2-wfa-boys'
  | 'cp2-wfa-girls'
  | 'cp2-hfa-boys'
  | 'cp2-hfa-girls'
  | 'cp2-bfa-boys'
  | 'cp2-bfa-girls'
  | 'cp3-wfa-boys'
  | 'cp3-wfa-girls'
  | 'cp3-hfa-boys'
  | 'cp3-hfa-girls'
  | 'cp3-bfa-boys'
  | 'cp3-bfa-girls'
  | 'cp4-wfa-boys'
  | 'cp4-wfa-girls'
  | 'cp4-hfa-boys'
  | 'cp4-hfa-girls'
  | 'cp4-bfa-boys'
  | 'cp4-bfa-girls'
  | 'cp5nt-wfa-boys'
  | 'cp5nt-wfa-girls'
  | 'cp5nt-hfa-boys'
  | 'cp5nt-hfa-girls'
  | 'cp5nt-bfa-boys'
  | 'cp5nt-bfa-girls'
  | 'cp5tf-wfa-boys'
  | 'cp5tf-wfa-girls'
  | 'cp5tf-hfa-boys'
  | 'cp5tf-hfa-girls'
  | 'cp5tf-bfa-boys'
  | 'cp5tf-bfa-girls';

/** Cache for loaded tables */
const cache = new Map<TableName, LmsRow[]>();

/** Dynamic import loaders for each table */
const loaders: Record<TableName, () => Promise<{ default: LmsRow[] }>> = {
  'wfa-boys-0-5': () => import('./wfa-boys-0-5.json'),
  'wfa-girls-0-5': () => import('./wfa-girls-0-5.json'),
  'lhfa-boys-0-5': () => import('./lhfa-boys-0-5.json'),
  'lhfa-girls-0-5': () => import('./lhfa-girls-0-5.json'),
  'bfa-boys-0-5': () => import('./bfa-boys-0-5.json'),
  'bfa-girls-0-5': () => import('./bfa-girls-0-5.json'),
  'hcfa-boys-0-5': () => import('./hcfa-boys-0-5.json'),
  'hcfa-girls-0-5': () => import('./hcfa-girls-0-5.json'),
  'wfa-boys-5-10': () => import('./wfa-boys-5-10.json'),
  'wfa-girls-5-10': () => import('./wfa-girls-5-10.json'),
  'hfa-boys-5-19': () => import('./hfa-boys-5-19.json'),
  'hfa-girls-5-19': () => import('./hfa-girls-5-19.json'),
  'bfa-boys-5-19': () => import('./bfa-boys-5-19.json'),
  'bfa-girls-5-19': () => import('./bfa-girls-5-19.json'),
  'wfl-boys': () => import('./wfl-boys.json'),
  'wfl-girls': () => import('./wfl-girls.json'),
  'wfh-boys': () => import('./wfh-boys.json'),
  'wfh-girls': () => import('./wfh-girls.json'),
  // Down syndrome (Zemel 2015)
  // Note: all DS files named "0-18" per publication convention (Zemel 2015);
  // WFA/LHFA/BFA data extends to 18y (6574 days), HCFA extends to 20y (7305 days)
  'ds-wfa-boys-0-18': () => import('./ds-wfa-boys-0-18.json'),
  'ds-wfa-girls-0-18': () => import('./ds-wfa-girls-0-18.json'),
  'ds-lhfa-boys-0-18': () => import('./ds-lhfa-boys-0-18.json'),
  'ds-lhfa-girls-0-18': () => import('./ds-lhfa-girls-0-18.json'),
  'ds-bfa-boys-0-18': () => import('./ds-bfa-boys-0-18.json'),
  'ds-bfa-girls-0-18': () => import('./ds-bfa-girls-0-18.json'),
  'ds-hcfa-boys-0-18': () => import('./ds-hcfa-boys-0-18.json'),
  'ds-hcfa-girls-0-18': () => import('./ds-hcfa-girls-0-18.json'),
  // Cerebral palsy (Brooks 2011)
  'cp1-wfa-boys': () => import('./cp1-wfa-boys.json'),
  'cp1-wfa-girls': () => import('./cp1-wfa-girls.json'),
  'cp1-hfa-boys': () => import('./cp1-hfa-boys.json'),
  'cp1-hfa-girls': () => import('./cp1-hfa-girls.json'),
  'cp1-bfa-boys': () => import('./cp1-bfa-boys.json'),
  'cp1-bfa-girls': () => import('./cp1-bfa-girls.json'),
  'cp2-wfa-boys': () => import('./cp2-wfa-boys.json'),
  'cp2-wfa-girls': () => import('./cp2-wfa-girls.json'),
  'cp2-hfa-boys': () => import('./cp2-hfa-boys.json'),
  'cp2-hfa-girls': () => import('./cp2-hfa-girls.json'),
  'cp2-bfa-boys': () => import('./cp2-bfa-boys.json'),
  'cp2-bfa-girls': () => import('./cp2-bfa-girls.json'),
  'cp3-wfa-boys': () => import('./cp3-wfa-boys.json'),
  'cp3-wfa-girls': () => import('./cp3-wfa-girls.json'),
  'cp3-hfa-boys': () => import('./cp3-hfa-boys.json'),
  'cp3-hfa-girls': () => import('./cp3-hfa-girls.json'),
  'cp3-bfa-boys': () => import('./cp3-bfa-boys.json'),
  'cp3-bfa-girls': () => import('./cp3-bfa-girls.json'),
  'cp4-wfa-boys': () => import('./cp4-wfa-boys.json'),
  'cp4-wfa-girls': () => import('./cp4-wfa-girls.json'),
  'cp4-hfa-boys': () => import('./cp4-hfa-boys.json'),
  'cp4-hfa-girls': () => import('./cp4-hfa-girls.json'),
  'cp4-bfa-boys': () => import('./cp4-bfa-boys.json'),
  'cp4-bfa-girls': () => import('./cp4-bfa-girls.json'),
  'cp5nt-wfa-boys': () => import('./cp5nt-wfa-boys.json'),
  'cp5nt-wfa-girls': () => import('./cp5nt-wfa-girls.json'),
  'cp5nt-hfa-boys': () => import('./cp5nt-hfa-boys.json'),
  'cp5nt-hfa-girls': () => import('./cp5nt-hfa-girls.json'),
  'cp5nt-bfa-boys': () => import('./cp5nt-bfa-boys.json'),
  'cp5nt-bfa-girls': () => import('./cp5nt-bfa-girls.json'),
  'cp5tf-wfa-boys': () => import('./cp5tf-wfa-boys.json'),
  'cp5tf-wfa-girls': () => import('./cp5tf-wfa-girls.json'),
  'cp5tf-hfa-boys': () => import('./cp5tf-hfa-boys.json'),
  'cp5tf-hfa-girls': () => import('./cp5tf-hfa-girls.json'),
  'cp5tf-bfa-boys': () => import('./cp5tf-bfa-boys.json'),
  'cp5tf-bfa-girls': () => import('./cp5tf-bfa-girls.json'),
};

/**
 * Load an LMS table by name. Tables are lazily loaded and cached.
 */
export async function loadTable(name: TableName): Promise<LmsRow[]> {
  const cached = cache.get(name);
  if (cached) return cached;

  const loader = loaders[name];
  // M3: do not reflect raw input in error message to avoid leaking arbitrary strings
  if (!loader) throw new Error('Unknown LMS table requested');

  const module = await loader();
  // Handle both { default: [...] } and direct array exports
  const data: LmsRow[] = Array.isArray(module) ? module : module.default;
  cache.set(name, data);
  return data;
}

/** Clear the cache (useful for testing) */
export function clearCache(): void {
  cache.clear();
}
