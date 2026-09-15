import { describe, it, expect } from 'vitest';
import { computeZScore, normalCdf, calculateZScore } from '../calculator.js';
import { lookupLms } from '../lms.js';
import type { LmsRow, Indicator, Sex, ChartSet } from '../types.js';

describe('normalCdf', () => {
  it('returns 0.5 for z = 0', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 4);
  });

  it('returns ~0.8413 for z = 1', () => {
    expect(normalCdf(1)).toBeCloseTo(0.8413, 3);
  });

  it('returns ~0.1587 for z = -1', () => {
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 3);
  });

  it('returns ~0.9772 for z = 2', () => {
    expect(normalCdf(2)).toBeCloseTo(0.9772, 3);
  });

  it('returns ~0.0228 for z = -2', () => {
    expect(normalCdf(-2)).toBeCloseTo(0.0228, 3);
  });

  it('handles extreme values', () => {
    expect(normalCdf(-15)).toBe(0);
    expect(normalCdf(15)).toBe(1);
  });
});

describe('computeZScore', () => {
  // Standard formula test with typical LMS values
  it('calculates z-score with standard formula', () => {
    // Using known LMS for weight-for-age boys at birth: L=0.3487, M=3.3464, S=0.14602
    const lms: LmsRow = { age: 0, L: 0.3487, M: 3.3464, S: 0.14602 };

    // At the median, z-score should be 0
    const zAtMedian = computeZScore(3.3464, lms);
    expect(zAtMedian).toBeCloseTo(0, 1);
  });

  it('returns positive z-score for measurement above median', () => {
    const lms: LmsRow = { age: 0, L: 0.3487, M: 3.3464, S: 0.14602 };
    const z = computeZScore(4.0, lms);
    expect(z).toBeGreaterThan(0);
  });

  it('returns negative z-score for measurement below median', () => {
    const lms: LmsRow = { age: 0, L: 0.3487, M: 3.3464, S: 0.14602 };
    const z = computeZScore(2.5, lms);
    expect(z).toBeLessThan(0);
  });

  it('handles L ≈ 0 (log formula)', () => {
    const lms: LmsRow = { age: 100, L: 0, M: 10, S: 0.1 };
    const z = computeZScore(10, lms); // At median
    expect(z).toBeCloseTo(0, 1);
  });

  it('handles L = 0 with non-median value', () => {
    const lms: LmsRow = { age: 100, L: 0, M: 10, S: 0.1 };
    const z = computeZScore(11, lms); // Above median
    expect(z).toBeGreaterThan(0);
  });

  it('applies WHO extrapolation for |Z| > 3', () => {
    // Create LMS that will produce Z > 3
    const lms: LmsRow = { age: 0, L: 0.3487, M: 3.3464, S: 0.14602 };
    const extremeWeight = 6.0; // Very heavy for a newborn
    const z = computeZScore(extremeWeight, lms);
    // Should still be > 3 but tempered by extrapolation
    expect(z).toBeGreaterThan(3);
  });

  it('returns NaN for zero measurement', () => {
    const lms: LmsRow = { age: 0, L: 0.3487, M: 3.3464, S: 0.14602 };
    expect(computeZScore(0, lms)).toBeNaN();
  });

  it('returns NaN for negative measurement', () => {
    const lms: LmsRow = { age: 0, L: 0.3487, M: 3.3464, S: 0.14602 };
    expect(computeZScore(-1, lms)).toBeNaN();
  });

  it('applies WHO extrapolation correctly when L ≈ 0', () => {
    // When L ≈ 0, the extrapolation should use exp(S*k) limit form
    // instead of (1 + L*S*k)^(1/L) which produces Infinity
    const lms: LmsRow = { age: 100, L: 0, M: 10, S: 0.1 };
    const extremeHigh = 20; // Very extreme value to trigger |Z| > 3
    const z = computeZScore(extremeHigh, lms);
    expect(z).toBeGreaterThan(3);
    expect(isFinite(z)).toBe(true);
  });

  it('applies WHO extrapolation correctly when L is very small', () => {
    const lms: LmsRow = { age: 100, L: 1e-12, M: 10, S: 0.1 };
    const extremeHigh = 20;
    const z = computeZScore(extremeHigh, lms);
    expect(z).toBeGreaterThan(3);
    expect(isFinite(z)).toBe(true);
  });
});

describe('lookupLms', () => {
  const table: LmsRow[] = [
    { age: 0, L: 0.3487, M: 3.3464, S: 0.14602 },
    { age: 1, L: 0.3487, M: 3.3957, S: 0.14642 },
    { age: 2, L: 0.3487, M: 3.4494, S: 0.14681 },
    { age: 3, L: 0.3487, M: 3.5074, S: 0.14718 },
  ];

  it('returns exact match', () => {
    const result = lookupLms(table, 0);
    expect(result).toEqual(table[0]);
  });

  it('interpolates between adjacent rows', () => {
    const result = lookupLms(table, 0.5);
    expect(result).not.toBeNull();
    expect(result!.M).toBeCloseTo((3.3464 + 3.3957) / 2, 3);
  });

  it('returns null for out-of-range index', () => {
    expect(lookupLms(table, -1)).toBeNull();
    expect(lookupLms(table, 4)).toBeNull();
  });

  it('returns null for empty table', () => {
    expect(lookupLms([], 0)).toBeNull();
  });

  it('returns last row for exact last index', () => {
    const result = lookupLms(table, 3);
    expect(result).toEqual(table[3]);
  });
});

describe('calculateZScore (integration with real data)', () => {
  it('calculates z-score for weight-for-age boys at birth', async () => {
    // WHO reference: 3.3464 kg is the median (z=0) for boys at birth
    const result = await calculateZScore({
      indicator: 'weight-for-age',
      sex: 'male',
      ageInDays: 0,
      measurement: 3.3464,
    });
    expect(result).not.toBeNull();
    expect(result!.zScore).toBeCloseTo(0, 1);
    expect(result!.percentile).toBeCloseTo(50, 5);
  });

  it('calculates z-score for weight-for-age girls at birth', async () => {
    const result = await calculateZScore({
      indicator: 'weight-for-age',
      sex: 'female',
      ageInDays: 0,
      measurement: 3.2322, // Girls median at birth
    });
    expect(result).not.toBeNull();
    expect(result!.zScore).toBeCloseTo(0, 1);
  });

  it('calculates z-score for length-for-age boys at birth', async () => {
    const result = await calculateZScore({
      indicator: 'length-height-for-age',
      sex: 'male',
      ageInDays: 0,
      measurement: 49.8842, // Boys median length at birth
    });
    expect(result).not.toBeNull();
    expect(result!.zScore).toBeCloseTo(0, 1);
  });

  it('calculates z-score for head circumference boys at birth', async () => {
    const result = await calculateZScore({
      indicator: 'head-circumference-for-age',
      sex: 'male',
      ageInDays: 0,
      measurement: 34.4618, // Boys median HC at birth
    });
    expect(result).not.toBeNull();
    expect(result!.zScore).toBeCloseTo(0, 1);
  });

  it('returns null for out-of-range indicator', async () => {
    const result = await calculateZScore({
      indicator: 'head-circumference-for-age',
      sex: 'male',
      ageInDays: 2000, // Beyond 5 years
      measurement: 50,
    });
    expect(result).toBeNull();
  });
});

describe('input validation', () => {
  it('rejects invalid indicator value', async () => {
    await expect(
      calculateZScore({
        indicator: 'height' as unknown as Indicator,
        sex: 'male',
        ageInDays: 0,
        measurement: 3.3,
      })
    ).rejects.toThrow(/Invalid indicator/);
  });

  it('rejects invalid sex value', async () => {
    await expect(
      calculateZScore({
        indicator: 'weight-for-age',
        sex: 'other' as unknown as Sex,
        ageInDays: 0,
        measurement: 3.3,
      })
    ).rejects.toThrow(/Invalid sex/);
  });

  it('rejects invalid chartSet value', async () => {
    await expect(
      calculateZScore({
        indicator: 'weight-for-age',
        sex: 'male',
        ageInDays: 0,
        measurement: 3.3,
        chartSet: 'invalid' as unknown as ChartSet,
      })
    ).rejects.toThrow(/Invalid chartSet/);
  });

  it('rejects negative measurement', async () => {
    await expect(
      calculateZScore({
        indicator: 'weight-for-age',
        sex: 'male',
        ageInDays: 0,
        measurement: -1,
      })
    ).rejects.toThrow(/Invalid measurement/);
  });

  it('rejects NaN measurement', async () => {
    await expect(
      calculateZScore({
        indicator: 'weight-for-age',
        sex: 'male',
        ageInDays: 0,
        measurement: NaN,
      })
    ).rejects.toThrow(/Invalid measurement/);
  });

  it('rejects Infinity measurement', async () => {
    await expect(
      calculateZScore({
        indicator: 'weight-for-age',
        sex: 'male',
        ageInDays: 0,
        measurement: Infinity,
      })
    ).rejects.toThrow(/Invalid measurement/);
  });
});

describe('calculateZScore with chartSet', () => {
  it('calculates z-score for Down syndrome weight-for-age', async () => {
    const result = await calculateZScore({
      indicator: 'weight-for-age',
      sex: 'male',
      ageInDays: 365,
      measurement: 9.084, // Zemel 2015 median for DS boys at 12 months
      chartSet: 'down-syndrome',
    });
    expect(result).not.toBeNull();
    expect(result!.zScore).toBeCloseTo(0, 0);
  });
});
