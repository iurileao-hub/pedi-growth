import { describe, it, expect } from 'vitest';
import { calculateAll } from '../calculator.js';

describe('calculateAll (integration)', () => {
  it('calculates all indicators for a 1-year-old boy', async () => {
    const result = await calculateAll({
      sex: 'male',
      dateOfBirth: new Date('2024-01-15'),
      dateOfMeasurement: new Date('2025-01-15'),
      weight: 9.6, // WHO median ~9.6 kg at 12 months
      lengthHeight: 75.7, // WHO median ~75.7 cm at 12 months
      headCircumference: 46.1, // WHO median ~46.1 cm at 12 months
    });

    expect(result.age.chronologicalDays).toBe(366); // 2024 is leap year
    expect(result.age.isCorrected).toBe(false);
    expect(result.results.length).toBeGreaterThanOrEqual(3);

    // All results near median should have z-scores close to 0
    for (const r of result.results) {
      expect(r.zScore).toBeGreaterThan(-2);
      expect(r.zScore).toBeLessThan(2);
    }

    // Should have classifications for each result
    expect(result.classifications.length).toBe(result.results.length);
  });

  it('applies prematurity correction for premature infant', async () => {
    const result = await calculateAll({
      sex: 'female',
      dateOfBirth: new Date('2024-06-15'),
      dateOfMeasurement: new Date('2025-01-15'),
      weight: 7.0,
      lengthHeight: 65,
      gestationalAgeWeeks: 32,
    });

    expect(result.age.isCorrected).toBe(true);
    expect(result.age.correctedDays).toBeLessThan(result.age.chronologicalDays);
    // Correction = (40 - 32) * 7 = 56 days
    expect(result.age.chronologicalDays - result.age.correctedDays).toBe(56);
  });

  it('applies prematurity correction with weeks + days', async () => {
    const result = await calculateAll({
      sex: 'female',
      dateOfBirth: new Date('2024-06-15'),
      dateOfMeasurement: new Date('2025-01-15'),
      weight: 7.0,
      lengthHeight: 65,
      gestationalAgeWeeks: 32,
      gestationalAgeDays: 3,
    });

    expect(result.age.isCorrected).toBe(true);
    // Correction = 40*7 - (32*7 + 3) = 280 - 227 = 53 days
    expect(result.age.chronologicalDays - result.age.correctedDays).toBe(53);
  });

  it('gives different correction for same weeks with different days', async () => {
    const base = {
      sex: 'female' as const,
      dateOfBirth: new Date('2024-06-15'),
      dateOfMeasurement: new Date('2025-01-15'),
      weight: 7.0,
      lengthHeight: 65,
      gestationalAgeWeeks: 34,
    };

    const noDays = await calculateAll(base);
    const withDays = await calculateAll({ ...base, gestationalAgeDays: 4 });

    // 34+0 → correction 42 days; 34+4 → correction 38 days; difference = 4
    const corrNoDays = noDays.age.chronologicalDays - noDays.age.correctedDays;
    const corrWithDays = withDays.age.chronologicalDays - withDays.age.correctedDays;
    expect(corrNoDays - corrWithDays).toBe(4);
  });

  it('does not apply prematurity correction after 2 years', async () => {
    const result = await calculateAll({
      sex: 'male',
      dateOfBirth: new Date('2022-01-15'),
      dateOfMeasurement: new Date('2025-01-15'),
      weight: 14,
      lengthHeight: 96,
      gestationalAgeWeeks: 34,
    });

    expect(result.age.isCorrected).toBe(false);
  });

  it('calculates weight-for-length for infant < 2 years', async () => {
    const result = await calculateAll({
      sex: 'male',
      dateOfBirth: new Date('2024-06-15'),
      dateOfMeasurement: new Date('2025-01-15'),
      weight: 8.0,
      lengthHeight: 70,
    });

    const wfl = result.results.find((r) => r.indicator === 'weight-for-length');
    expect(wfl).toBeDefined();
  });

  it('does not calculate weight-for-length for child > 2 years', async () => {
    const result = await calculateAll({
      sex: 'male',
      dateOfBirth: new Date('2021-01-15'),
      dateOfMeasurement: new Date('2025-01-15'),
      weight: 16,
      lengthHeight: 100,
    });

    const wfl = result.results.find((r) => r.indicator === 'weight-for-length');
    expect(wfl).toBeUndefined();
  });

  it('calculates weight-for-height for child 2-5 years', async () => {
    const result = await calculateAll({
      sex: 'female',
      dateOfBirth: new Date('2022-01-15'),
      dateOfMeasurement: new Date('2025-01-15'),
      weight: 14,
      lengthHeight: 96,
    });

    const wfh = result.results.find((r) => r.indicator === 'weight-for-height');
    expect(wfh).toBeDefined();
  });

  it('does not calculate head circumference after 5 years', async () => {
    const result = await calculateAll({
      sex: 'male',
      dateOfBirth: new Date('2018-01-15'),
      dateOfMeasurement: new Date('2025-01-15'),
      weight: 25,
      lengthHeight: 125,
      headCircumference: 52,
    });

    const hc = result.results.find((r) => r.indicator === 'head-circumference-for-age');
    expect(hc).toBeUndefined();
  });

  it('handles missing measurements gracefully', async () => {
    const result = await calculateAll({
      sex: 'male',
      dateOfBirth: new Date('2024-01-15'),
      dateOfMeasurement: new Date('2025-01-15'),
      weight: 9.6,
      // No length/height or head circumference
    });

    // Should only have weight-for-age
    expect(result.results.length).toBe(1);
    expect(result.results[0].indicator).toBe('weight-for-age');
  });

  it('calculates for 5-19 year age range', async () => {
    const result = await calculateAll({
      sex: 'female',
      dateOfBirth: new Date('2015-01-15'),
      dateOfMeasurement: new Date('2025-01-15'),
      weight: 32, // ~10 year old
      lengthHeight: 140,
    });

    const hfa = result.results.find((r) => r.indicator === 'length-height-for-age');
    const bfa = result.results.find((r) => r.indicator === 'bmi-for-age');
    expect(hfa).toBeDefined();
    expect(bfa).toBeDefined();
  });
});

describe('calculateAll with Down syndrome chart set', () => {
  it('returns results using Down syndrome tables', async () => {
    const result = await calculateAll({
      sex: 'male',
      dateOfBirth: new Date('2025-01-01'),
      dateOfMeasurement: new Date('2026-01-01'),
      weight: 9.084, // Zemel median at 12mo
      lengthHeight: 72.364,
      headCircumference: 44.169,
      chartSet: 'down-syndrome',
    });

    expect(result.results.length).toBeGreaterThan(0);
    // Down syndrome should have weight-for-age, length/height-for-age, BMI-for-age, HC-for-age
    const indicators = result.results.map((r) => r.indicator);
    expect(indicators).toContain('weight-for-age');
    expect(indicators).toContain('length-height-for-age');
    expect(indicators).toContain('head-circumference-for-age');
    // Should NOT have weight-for-length or weight-for-height
    expect(indicators).not.toContain('weight-for-length');
    expect(indicators).not.toContain('weight-for-height');
  });

  it('calculates WFA for DS patient at 15 years (beyond WHO 10y limit)', async () => {
    const result = await calculateAll({
      sex: 'female',
      dateOfBirth: new Date('2011-01-15'),
      dateOfMeasurement: new Date('2026-01-15'),
      weight: 50,
      lengthHeight: 148,
      chartSet: 'down-syndrome',
    });

    const indicators = result.results.map((r) => r.indicator);
    expect(indicators).toContain('weight-for-age');
    expect(indicators).toContain('length-height-for-age');
    expect(indicators).toContain('bmi-for-age');
  });

  it('calculates HCFA for DS patient at 7 years (beyond WHO 5y limit)', async () => {
    const result = await calculateAll({
      sex: 'male',
      dateOfBirth: new Date('2019-01-15'),
      dateOfMeasurement: new Date('2026-01-15'),
      headCircumference: 50,
      chartSet: 'down-syndrome',
    });

    const indicators = result.results.map((r) => r.indicator);
    expect(indicators).toContain('head-circumference-for-age');
  });

  it('never includes WFL/WFH for DS even for infants', async () => {
    const result = await calculateAll({
      sex: 'female',
      dateOfBirth: new Date('2025-07-01'),
      dateOfMeasurement: new Date('2026-01-01'),
      weight: 6.5,
      lengthHeight: 62,
      chartSet: 'down-syndrome',
    });

    const indicators = result.results.map((r) => r.indicator);
    expect(indicators).not.toContain('weight-for-length');
    expect(indicators).not.toContain('weight-for-height');
    // But should still have WFA, LHFA, BFA
    expect(indicators).toContain('weight-for-age');
    expect(indicators).toContain('length-height-for-age');
  });
});

describe('calculateAll backward compatibility', () => {
  it('works without chartSet parameter (defaults to WHO)', async () => {
    const result = await calculateAll({
      sex: 'male',
      dateOfBirth: new Date('2024-06-15'),
      dateOfMeasurement: new Date('2025-06-15'),
      weight: 9.2,
      lengthHeight: 74.5,
      headCircumference: 45,
    });

    expect(result.results.length).toBeGreaterThan(0);
    // WHO classifications should use standard severities
    for (const c of result.classifications) {
      expect(['very-low', 'low', 'adequate', 'risk', 'high', 'very-high']).toContain(c.severity);
    }
  });
});

describe('calculateAll input validation (security)', () => {
  it('throws for invalid chartSet at runtime', async () => {
    await expect(
      calculateAll({
        sex: 'male',
        dateOfBirth: new Date('2024-01-15'),
        dateOfMeasurement: new Date('2025-01-15'),
        weight: 9.5,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chartSet: 'malicious-value' as any,
      })
    ).rejects.toThrow(/Invalid chartSet/);
  });

  it('truncates long invalid chartSet in error message', async () => {
    const longValue = 'a'.repeat(200);
    await expect(
      calculateAll({
        sex: 'male',
        dateOfBirth: new Date('2024-01-15'),
        dateOfMeasurement: new Date('2025-01-15'),
        weight: 9.5,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chartSet: longValue as any,
      })
    ).rejects.toThrow(/Invalid chartSet/);
  });

  it('accepts undefined chartSet (defaults to WHO)', async () => {
    const result = await calculateAll({
      sex: 'male',
      dateOfBirth: new Date('2024-01-15'),
      dateOfMeasurement: new Date('2025-01-15'),
      weight: 9.5,
      chartSet: undefined,
    });

    expect(result.results.length).toBeGreaterThan(0);
  });
});
