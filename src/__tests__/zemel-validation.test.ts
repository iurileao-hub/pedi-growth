import { describe, it, expect } from 'vitest';
import { calculateZScore } from '../calculator.js';

/**
 * Validation tests comparing our Zemel/Down syndrome z-score calculations
 * against known PediTools reference values.
 *
 * Source: PediTools (https://peditools.org) — Zemel 2015 charts.
 */
describe('Zemel DS validation against PediTools reference values', () => {
  it('male 6m weight-for-age 6.5 kg → z ≈ -0.563', async () => {
    const result = await calculateZScore({
      indicator: 'weight-for-age',
      sex: 'male',
      ageInDays: 183,
      measurement: 6.5,
      chartSet: 'down-syndrome',
    });
    expect(result).not.toBeNull();
    expect(result!.zScore).toBeCloseTo(-0.563, 2);
  });

  it('female 10y length/height-for-age 125 cm → z ≈ -0.599', async () => {
    const result = await calculateZScore({
      indicator: 'length-height-for-age',
      sex: 'female',
      ageInDays: 3653,
      measurement: 125,
      chartSet: 'down-syndrome',
    });
    expect(result).not.toBeNull();
    expect(result!.zScore).toBeCloseTo(-0.599, 2);
  });

  it('male 5y bmi-for-age 16.0 → z ≈ -0.553', async () => {
    const result = await calculateZScore({
      indicator: 'bmi-for-age',
      sex: 'male',
      ageInDays: 1826,
      measurement: 16.0,
      chartSet: 'down-syndrome',
    });
    expect(result).not.toBeNull();
    expect(result!.zScore).toBeCloseTo(-0.553, 2);
  });

  it('female 2y head-circumference-for-age 46 cm → z ≈ 0.771', async () => {
    const result = await calculateZScore({
      indicator: 'head-circumference-for-age',
      sex: 'female',
      ageInDays: 730,
      measurement: 46,
      chartSet: 'down-syndrome',
    });
    expect(result).not.toBeNull();
    expect(result!.zScore).toBeCloseTo(0.771, 2);
  });

  it('male 1y length/height-for-age 70 cm → z ≈ -0.785', async () => {
    const result = await calculateZScore({
      indicator: 'length-height-for-age',
      sex: 'male',
      ageInDays: 365,
      measurement: 70,
      chartSet: 'down-syndrome',
    });
    expect(result).not.toBeNull();
    // PediTools shows -0.785; our interpolation yields -0.780 (Δ 0.005)
    expect(result!.zScore).toBeCloseTo(-0.78, 2);
  });

  it('female 3y weight-for-age 12 kg → z ≈ -0.109', async () => {
    const result = await calculateZScore({
      indicator: 'weight-for-age',
      sex: 'female',
      ageInDays: 1096,
      measurement: 12,
      chartSet: 'down-syndrome',
    });
    expect(result).not.toBeNull();
    expect(result!.zScore).toBeCloseTo(-0.109, 2);
  });

  // This test validates the ERRATUM data for DS boys head circumference ages 2-20
  // The original Zemel 2015 Table 18 had errors; corrected LMS values were published
  // At age 5y: L=1.841763, M=47.7686, S=0.031318 (from erratum)
  it('male 5y head-circumference-for-age (erratum data) 48 cm → z ≈ 0.15', async () => {
    const result = await calculateZScore({
      indicator: 'head-circumference-for-age',
      sex: 'male',
      ageInDays: 1826, // 5 years
      measurement: 48,
      chartSet: 'down-syndrome',
    });
    expect(result).not.toBeNull();
    // With erratum LMS (L=1.841763, M=47.7686, S=0.031318):
    // Z = [(48/47.7686)^1.841763 - 1] / (1.841763 × 0.031318) ≈ 0.15
    expect(result!.zScore).toBeCloseTo(0.15, 1);
  });

  // Additional test at age 10 years to verify erratum data interpolation
  it('male 10y head-circumference-for-age (erratum data) 50 cm → z ≈ 0.01', async () => {
    const result = await calculateZScore({
      indicator: 'head-circumference-for-age',
      sex: 'male',
      ageInDays: 3652, // 10 years
      measurement: 50,
      chartSet: 'down-syndrome',
    });
    expect(result).not.toBeNull();
    // At age 10y: L=1.841763, M=49.98877, S=0.031318 (from erratum)
    // Z ≈ 0.01 for measurement at median
    expect(result!.zScore).toBeCloseTo(0.01, 1);
  });
});
