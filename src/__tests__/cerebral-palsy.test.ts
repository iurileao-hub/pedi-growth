import { describe, it, expect, beforeEach } from 'vitest';
import { calculateZScore, calculateAll, computeZScore, CP_AGE_LIMITS } from '../calculator';
import { lookupLms, resolveTable } from '../lms';
import { classify } from '../classify';
import { loadTable, clearCache } from '../data/index';
import type { GmfcsLevel, ZScoreResult } from '../types';

beforeEach(() => {
  clearCache();
});

// ── Data loading ──

describe('CP data loading', () => {
  const GMFCS_PREFIXES = ['cp1', 'cp2', 'cp3', 'cp4', 'cp5nt', 'cp5tf'] as const;
  const MEASURES = ['wfa', 'hfa', 'bfa'] as const;
  const SEXES = ['boys', 'girls'] as const;

  for (const prefix of GMFCS_PREFIXES) {
    for (const measure of MEASURES) {
      for (const sex of SEXES) {
        const tableName = `${prefix}-${measure}-${sex}`;
        it(`loads ${tableName} with 37 rows`, async () => {
          const data = await loadTable(tableName as Parameters<typeof loadTable>[0]);
          expect(data).toHaveLength(37);
          expect(data[0].age).toBe(731); // 2 years
          expect(data[data.length - 1].age).toBe(7305); // 20 years
          // Each row should have valid LMS values
          for (const row of data) {
            expect(row.M).toBeGreaterThan(0);
            expect(row.S).toBeGreaterThan(0);
            expect(typeof row.L).toBe('number');
          }
        });
      }
    }
  }
});

// ── resolveTable ──

describe('resolveTable for cerebral palsy', () => {
  const GMFCS_LEVELS: GmfcsLevel[] = [1, 2, 3, 4, '5-oral', '5-tube'];

  it('resolves WFA for each GMFCS level', async () => {
    for (const level of GMFCS_LEVELS) {
      const result = await resolveTable({
        indicator: 'weight-for-age',
        sex: 'male',
        ageInDays: 1461, // 4 years
        chartSet: 'cerebral-palsy',
        gmfcsLevel: level,
      });
      expect(result).not.toBeNull();
      expect(result!.index).toBe(1461);
    }
  });

  it('resolves HFA for cerebral palsy', async () => {
    const result = await resolveTable({
      indicator: 'length-height-for-age',
      sex: 'female',
      ageInDays: 3653, // ~10 years
      chartSet: 'cerebral-palsy',
      gmfcsLevel: 3,
    });
    expect(result).not.toBeNull();
  });

  it('resolves BFA for cerebral palsy', async () => {
    const result = await resolveTable({
      indicator: 'bmi-for-age',
      sex: 'male',
      ageInDays: 5479, // ~15 years
      chartSet: 'cerebral-palsy',
      gmfcsLevel: 2,
    });
    expect(result).not.toBeNull();
  });

  it('returns null for head-circumference (not available for CP)', async () => {
    const result = await resolveTable({
      indicator: 'head-circumference-for-age',
      sex: 'male',
      ageInDays: 1461,
      chartSet: 'cerebral-palsy',
      gmfcsLevel: 1,
    });
    expect(result).toBeNull();
  });

  it('returns null for weight-for-length (not available for CP)', async () => {
    const result = await resolveTable({
      indicator: 'weight-for-length',
      sex: 'male',
      lengthHeight: 80,
      chartSet: 'cerebral-palsy',
      gmfcsLevel: 1,
    });
    expect(result).toBeNull();
  });

  it('returns null for weight-for-height (not available for CP)', async () => {
    const result = await resolveTable({
      indicator: 'weight-for-height',
      sex: 'female',
      lengthHeight: 100,
      chartSet: 'cerebral-palsy',
      gmfcsLevel: 2,
    });
    expect(result).toBeNull();
  });

  it('returns null if gmfcsLevel is missing', async () => {
    const result = await resolveTable({
      indicator: 'weight-for-age',
      sex: 'male',
      ageInDays: 1461,
      chartSet: 'cerebral-palsy',
    });
    expect(result).toBeNull();
  });
});

// ── Z-score calculation ──

describe('CP z-score calculation', () => {
  it('returns z=0 when measurement equals median', async () => {
    // Load the CP1 WFA boys table, get the median at age 731 (2 years)
    const table = await loadTable('cp1-wfa-boys');
    const lms = lookupLms(table, 731);
    expect(lms).not.toBeNull();

    const z = computeZScore(lms!.M, lms!);
    expect(z).toBe(0);
  });

  it('calculates positive z-score for above-median weight', async () => {
    const result = await calculateZScore({
      indicator: 'weight-for-age',
      sex: 'male',
      ageInDays: 731,
      measurement: 15, // well above median for CP1 boys at 2y
      chartSet: 'cerebral-palsy',
      gmfcsLevel: 1,
    });
    expect(result).not.toBeNull();
    expect(result!.zScore).toBeGreaterThan(0);
    expect(result!.percentile).toBeGreaterThan(50);
  });

  it('calculates negative z-score for below-median weight', async () => {
    const result = await calculateZScore({
      indicator: 'weight-for-age',
      sex: 'female',
      ageInDays: 3653, // ~10 years
      measurement: 15, // below median for most GMFCS levels
      chartSet: 'cerebral-palsy',
      gmfcsLevel: 3,
    });
    expect(result).not.toBeNull();
    expect(result!.zScore).toBeLessThan(0);
    expect(result!.percentile).toBeLessThan(50);
  });

  it('returns null for age below 2 years (out of CP range)', async () => {
    const result = await calculateZScore({
      indicator: 'weight-for-age',
      sex: 'male',
      ageInDays: 365, // 1 year — below CP range
      measurement: 10,
      chartSet: 'cerebral-palsy',
      gmfcsLevel: 1,
    });
    expect(result).toBeNull();
  });

  it('returns null for age above 20 years (out of CP range)', async () => {
    const result = await calculateZScore({
      indicator: 'weight-for-age',
      sex: 'male',
      ageInDays: 7400, // above 20 years
      measurement: 70,
      chartSet: 'cerebral-palsy',
      gmfcsLevel: 1,
    });
    expect(result).toBeNull();
  });

  it('throws error if chartSet is cerebral-palsy but gmfcsLevel is missing', async () => {
    await expect(
      calculateZScore({
        indicator: 'weight-for-age',
        sex: 'male',
        ageInDays: 1461,
        measurement: 15,
        chartSet: 'cerebral-palsy',
      })
    ).rejects.toThrow('gmfcsLevel is required');
  });

  it('ignores gmfcsLevel for WHO chart set', async () => {
    const result = await calculateZScore({
      indicator: 'weight-for-age',
      sex: 'male',
      ageInDays: 365,
      measurement: 10,
      chartSet: 'who-standard',
      gmfcsLevel: 1,
    });
    expect(result).not.toBeNull();
  });
});

// ── Golden tests: z=0 returns median for each curve ──

describe('CP golden tests: z=0 → median', () => {
  const GMFCS_LEVELS: GmfcsLevel[] = [1, 2, 3, 4, '5-oral', '5-tube'];
  const indicators = [
    { name: 'weight-for-age' as const, measure: 'wfa' },
    { name: 'length-height-for-age' as const, measure: 'hfa' },
    { name: 'bmi-for-age' as const, measure: 'bfa' },
  ];

  for (const level of GMFCS_LEVELS) {
    for (const { name, measure } of indicators) {
      it(`GMFCS ${level} ${name} boys — median yields z=0`, async () => {
        const prefix = {
          1: 'cp1',
          2: 'cp2',
          3: 'cp3',
          4: 'cp4',
          '5-oral': 'cp5nt',
          '5-tube': 'cp5tf',
        }[String(level)];
        const table = await loadTable(
          `${prefix}-${measure}-boys` as Parameters<typeof loadTable>[0]
        );
        // Test at midpoint (age ~11 years = 4018 days)
        const lms = lookupLms(table, 4018);
        expect(lms).not.toBeNull();

        const result = await calculateZScore({
          indicator: name,
          sex: 'male',
          ageInDays: 4018,
          measurement: lms!.M,
          chartSet: 'cerebral-palsy',
          gmfcsLevel: level,
        });
        expect(result).not.toBeNull();
        expect(result!.zScore).toBe(0);
        expect(result!.percentile).toBe(50);
      });
    }
  }
});

// ── Classification ──

describe('CP classification', () => {
  it('classifies weight < P5 as very-low for GMFCS I', () => {
    // normalCdf(-1.645) ≈ 5%, so z=-2 → P~2.3 → very-low for GMFCS I-II
    const result: ZScoreResult = { indicator: 'weight-for-age', zScore: -2, percentile: 2.3 };
    const classification = classify(result, 1461, 'cerebral-palsy', 1);
    expect(classification.severity).toBe('very-low');
    expect(classification.label).toBe('Underweight (increased risk)');
  });

  it('classifies weight P5-P10 as low for GMFCS II', () => {
    // normalCdf(-1.44) ≈ 7.5%
    const result: ZScoreResult = { indicator: 'weight-for-age', zScore: -1.44, percentile: 7.5 };
    const classification = classify(result, 1461, 'cerebral-palsy', 2);
    expect(classification.severity).toBe('low');
    expect(classification.label).toBe('Borderline weight');
  });

  it('classifies weight ≥ P10 as adequate for GMFCS I', () => {
    const result: ZScoreResult = { indicator: 'weight-for-age', zScore: 0, percentile: 50 };
    const classification = classify(result, 1461, 'cerebral-palsy', 1);
    expect(classification.severity).toBe('adequate');
    expect(classification.label).toBe('Adequate weight');
  });

  it('classifies weight < P10 as very-low for GMFCS III', () => {
    // z=-1.44 → P~7.5 → very-low for GMFCS III-V
    const result: ZScoreResult = { indicator: 'weight-for-age', zScore: -1.44, percentile: 7.5 };
    const classification = classify(result, 1461, 'cerebral-palsy', 3);
    expect(classification.severity).toBe('very-low');
    expect(classification.label).toBe('Underweight (increased risk)');
  });

  it('classifies weight P10-P20 as low for GMFCS IV', () => {
    // normalCdf(-1.04) ≈ 15%
    const result: ZScoreResult = { indicator: 'weight-for-age', zScore: -1.04, percentile: 15 };
    const classification = classify(result, 1461, 'cerebral-palsy', 4);
    expect(classification.severity).toBe('low');
    expect(classification.label).toBe('Borderline weight');
  });

  it('classifies weight ≥ P20 as adequate for GMFCS V-oral', () => {
    const result: ZScoreResult = { indicator: 'weight-for-age', zScore: 0, percentile: 50 };
    const classification = classify(result, 1461, 'cerebral-palsy', '5-oral');
    expect(classification.severity).toBe('adequate');
    expect(classification.label).toBe('Adequate weight');
  });

  it('classifies weight P10-P20 as low for GMFCS V-tube', () => {
    const result: ZScoreResult = { indicator: 'weight-for-age', zScore: -1.04, percentile: 15 };
    const classification = classify(result, 1461, 'cerebral-palsy', '5-tube');
    expect(classification.severity).toBe('low');
    expect(classification.label).toBe('Borderline weight');
  });

  it('classifies height < -2 as low for CP', () => {
    const result: ZScoreResult = {
      indicator: 'length-height-for-age',
      zScore: -2.5,
      percentile: 0.6,
    };
    const classification = classify(result, 1461, 'cerebral-palsy', 2);
    expect(classification.severity).toBe('low');
    expect(classification.label).toBe('Low stature for age');
  });

  it('classifies height in normal range as adequate for CP', () => {
    const result: ZScoreResult = {
      indicator: 'length-height-for-age',
      zScore: -0.5,
      percentile: 30.9,
    };
    const classification = classify(result, 1461, 'cerebral-palsy', 2);
    expect(classification.severity).toBe('adequate');
    expect(classification.label).toBe('Adequate stature for age');
  });

  it('classifies BMI in normal range as adequate for CP', () => {
    const result: ZScoreResult = { indicator: 'bmi-for-age', zScore: 0.5, percentile: 69.1 };
    const classification = classify(result, 1461, 'cerebral-palsy', 1);
    expect(classification.severity).toBe('adequate');
    expect(classification.label).toBe('Adequate');
  });
});

// ── CP_AGE_LIMITS ──

describe('CP_AGE_LIMITS', () => {
  it('defines limits for WFA, HFA, BFA', () => {
    expect(CP_AGE_LIMITS['weight-for-age']).toEqual({ minDays: 731, maxDays: 7305 });
    expect(CP_AGE_LIMITS['length-height-for-age']).toEqual({ minDays: 731, maxDays: 7305 });
    expect(CP_AGE_LIMITS['bmi-for-age']).toEqual({ minDays: 731, maxDays: 7305 });
  });

  it('does not define limits for HC, WFL, WFH', () => {
    expect(CP_AGE_LIMITS['head-circumference-for-age']).toBeUndefined();
    expect(CP_AGE_LIMITS['weight-for-length']).toBeUndefined();
    expect(CP_AGE_LIMITS['weight-for-height']).toBeUndefined();
  });
});

// ── Integration: calculateAll ──

describe('calculateAll with CP', () => {
  it('calculates WFA, HFA, BFA for a 5-year-old with GMFCS 1', async () => {
    const result = await calculateAll({
      sex: 'male',
      dateOfBirth: new Date('2020-01-01'),
      dateOfMeasurement: new Date('2025-01-01'), // 5 years
      weight: 18,
      lengthHeight: 110,
      headCircumference: 51,
      chartSet: 'cerebral-palsy',
      gmfcsLevel: 1,
    });

    expect(result.results.length).toBe(3); // WFA, HFA, BFA
    const indicators = result.results.map((r) => r.indicator);
    expect(indicators).toContain('weight-for-age');
    expect(indicators).toContain('length-height-for-age');
    expect(indicators).toContain('bmi-for-age');
    // No HC or WFL/WFH for CP
    expect(indicators).not.toContain('head-circumference-for-age');
    expect(indicators).not.toContain('weight-for-length');
    expect(indicators).not.toContain('weight-for-height');

    // Classifications should exist
    expect(result.classifications.length).toBe(3);
  });

  it('returns no results for age < 2 years with CP', async () => {
    const result = await calculateAll({
      sex: 'female',
      dateOfBirth: new Date('2024-01-01'),
      dateOfMeasurement: new Date('2025-01-01'), // 1 year
      weight: 10,
      lengthHeight: 75,
      chartSet: 'cerebral-palsy',
      gmfcsLevel: 3,
    });

    expect(result.results.length).toBe(0);
  });

  it('throws error when gmfcsLevel is missing for CP', async () => {
    await expect(
      calculateAll({
        sex: 'male',
        dateOfBirth: new Date('2020-01-01'),
        dateOfMeasurement: new Date('2025-01-01'),
        weight: 18,
        chartSet: 'cerebral-palsy',
      })
    ).rejects.toThrow('gmfcsLevel is required');
  });

  it('calculates with GMFCS 5-tube', async () => {
    const result = await calculateAll({
      sex: 'female',
      dateOfBirth: new Date('2015-01-01'),
      dateOfMeasurement: new Date('2025-01-01'), // 10 years
      weight: 25,
      lengthHeight: 120,
      chartSet: 'cerebral-palsy',
      gmfcsLevel: '5-tube',
    });

    expect(result.results.length).toBe(3);
    // GMFCS V tube-fed patients tend to have different weight distributions
    const wfa = result.results.find((r) => r.indicator === 'weight-for-age');
    expect(wfa).toBeDefined();
    expect(typeof wfa!.zScore).toBe('number');
    expect(typeof wfa!.percentile).toBe('number');
  });
});

// ── chartSet validation ──

describe('chartSet validation', () => {
  it('accepts cerebral-palsy as valid chartSet', async () => {
    // Should not throw
    const result = await calculateZScore({
      indicator: 'weight-for-age',
      sex: 'male',
      ageInDays: 1461,
      measurement: 15,
      chartSet: 'cerebral-palsy',
      gmfcsLevel: 1,
    });
    expect(result).not.toBeNull();
  });

  it('rejects invalid chartSet', async () => {
    await expect(
      calculateZScore({
        indicator: 'weight-for-age',
        sex: 'male',
        ageInDays: 1461,
        measurement: 15,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chartSet: 'invalid' as any,
      })
    ).rejects.toThrow('Invalid chartSet');
  });
});
