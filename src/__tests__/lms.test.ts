import { describe, it, expect } from 'vitest';
import { resolveTable } from '../lms.js';

describe('resolveTable chart-set routing', () => {
  it('routes WHO standard weight-for-age boys (default)', async () => {
    const result = await resolveTable({
      indicator: 'weight-for-age',
      sex: 'male',
      ageInDays: 100,
    });
    expect(result).not.toBeNull();
    expect(result!.index).toBe(100);
  });

  it('routes WHO standard when chartSet is explicit', async () => {
    const result = await resolveTable({
      indicator: 'weight-for-age',
      sex: 'male',
      ageInDays: 100,
      chartSet: 'who-standard',
    });
    expect(result).not.toBeNull();
  });

  it('routes Down syndrome weight-for-age boys', async () => {
    const result = await resolveTable({
      indicator: 'weight-for-age',
      sex: 'male',
      ageInDays: 365,
      chartSet: 'down-syndrome',
    });
    expect(result).not.toBeNull();
    expect(result!.index).toBe(365);
  });

  it('returns null for Down syndrome weight-for-length (unsupported)', async () => {
    const result = await resolveTable({
      indicator: 'weight-for-length',
      sex: 'male',
      lengthHeight: 60,
      chartSet: 'down-syndrome',
    });
    expect(result).toBeNull();
  });
});
