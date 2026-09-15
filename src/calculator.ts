import type {
  ZScoreInput,
  ZScoreResult,
  AssessmentInput,
  AssessmentResult,
  Indicator,
  ChartSet,
  LmsRow,
} from './types.js';
import { lookupLms, resolveTable } from './lms.js';
import { calculateAge } from './age.js';
import { classifyAll } from './classify.js';
// normalCdf used internally and re-exported for backward compatibility (see below)
import { normalCdf } from './gaussian.js';

/** Valid chart set values (runtime validation for JS consumers) */
const VALID_CHART_SETS = new Set<ChartSet>(['who-standard', 'down-syndrome', 'cerebral-palsy']);

/** Valid sex values (runtime validation for JS consumers) */
const VALID_SEXES = new Set<string>(['male', 'female']);

/** Valid indicator values (runtime validation for JS consumers) */
const VALID_INDICATORS = new Set<string>([
  'weight-for-age',
  'length-height-for-age',
  'bmi-for-age',
  'head-circumference-for-age',
  'weight-for-length',
  'weight-for-height',
]);

function validateChartSet(chartSet: string | undefined): asserts chartSet is ChartSet | undefined {
  if (chartSet != null && !VALID_CHART_SETS.has(chartSet as ChartSet)) {
    throw new Error(
      `Invalid chartSet: expected 'who-standard', 'down-syndrome', or 'cerebral-palsy', got '${String(chartSet).slice(0, 50)}'`
    );
  }
}

function validateSex(sex: string): void {
  if (!VALID_SEXES.has(sex)) {
    throw new Error(`Invalid sex: expected 'male' or 'female', got '${String(sex).slice(0, 50)}'`);
  }
}

function validateIndicator(indicator: string): void {
  if (!VALID_INDICATORS.has(indicator)) {
    throw new Error(`Invalid indicator: '${String(indicator).slice(0, 50)}'`);
  }
}

function validateMeasurement(value: number | undefined, name: string): void {
  if (value != null && (!isFinite(value) || value <= 0)) {
    throw new Error(`Invalid ${name}: must be a positive finite number`);
  }
}

/** Age limits in days for cerebral palsy (Brooks 2011): all 2-20 years */
export const CP_AGE_LIMITS: Partial<Record<Indicator, { minDays: number; maxDays: number }>> = {
  'weight-for-age': { minDays: 731, maxDays: 7305 },
  'length-height-for-age': { minDays: 731, maxDays: 7305 },
  'bmi-for-age': { minDays: 731, maxDays: 7305 },
};

// Re-export normalCdf for backward compatibility (moved to gaussian.ts to break circular dependency)
export { normalCdf } from './gaussian.js';

/**
 * Calculate z-score from measurement and LMS parameters.
 *
 * Standard formula: Z = ((measurement/M)^L - 1) / (L * S)
 * When L = 0: Z = ln(measurement/M) / S
 *
 * WHO extrapolation for |Z| > 3:
 *   SD3pos = M * (1 + L*S*3)^(1/L)
 *   SD23pos = SD3pos - SD2pos
 *   If Z > 3: Z = 3 + (measurement - SD3pos) / SD23pos
 *   If Z < -3: Z = -3 + (measurement - SD3neg) / SD23neg
 */
export function computeZScore(measurement: number, lms: LmsRow): number {
  const { L, M, S } = lms;

  if (measurement <= 0 || M <= 0 || S <= 0) return NaN;

  let z: number;

  if (Math.abs(L) < 1e-10) {
    // L ≈ 0: use log formula
    z = Math.log(measurement / M) / S;
  } else {
    z = (Math.pow(measurement / M, L) - 1) / (L * S);
  }

  // WHO extrapolation for |Z| > 3
  if (Math.abs(z) > 3) {
    // SD_k = M * (1 + L*S*k)^(1/L), or M * exp(S*k) when L ≈ 0
    const sdValue = (k: number) =>
      Math.abs(L) < 1e-10 ? M * Math.exp(S * k) : M * Math.pow(1 + L * S * k, 1 / L);

    const sd3pos = sdValue(3);
    const sd2pos = sdValue(2);
    const sd3neg = sdValue(-3);
    const sd2neg = sdValue(-2);

    const sd23pos = sd3pos - sd2pos;
    const sd23neg = sd2neg - sd3neg;

    if (z > 3) {
      z = 3 + (measurement - sd3pos) / sd23pos;
    } else {
      z = -3 + (measurement - sd3neg) / sd23neg;
    }
  }

  // || 0 normalizes IEEE 754 negative zero (-0) to positive zero (0)
  return Math.round(z * 100) / 100 || 0;
}

/**
 * Calculate z-score and percentile for a single indicator.
 */
export async function calculateZScore(input: ZScoreInput): Promise<ZScoreResult | null> {
  validateIndicator(input.indicator);
  validateSex(input.sex);
  validateChartSet(input.chartSet);
  validateMeasurement(input.measurement, 'measurement');

  if (input.chartSet === 'cerebral-palsy' && input.gmfcsLevel == null) {
    throw new Error('gmfcsLevel is required when chartSet is cerebral-palsy');
  }

  const resolved = await resolveTable({
    indicator: input.indicator,
    sex: input.sex,
    ageInDays: input.ageInDays,
    lengthHeight: input.lengthHeight,
    chartSet: input.chartSet,
    gmfcsLevel: input.gmfcsLevel,
  });

  if (!resolved) return null;

  const lms = lookupLms(resolved.table, resolved.index);
  if (!lms) return null;

  const zScore = computeZScore(input.measurement, lms);
  if (isNaN(zScore)) return null;

  const percentile = Math.round(normalCdf(zScore) * 1000) / 10;

  return {
    indicator: input.indicator,
    zScore,
    percentile,
  };
}

/**
 * Calculate all applicable indicators for a patient.
 */
export async function calculateAll(input: AssessmentInput): Promise<AssessmentResult> {
  validateSex(input.sex);
  validateChartSet(input.chartSet);
  validateMeasurement(input.weight, 'weight');
  validateMeasurement(input.lengthHeight, 'lengthHeight');
  validateMeasurement(input.headCircumference, 'headCircumference');

  const chartSet = input.chartSet ?? 'who-standard';
  const isCp = chartSet === 'cerebral-palsy';

  if (isCp && input.gmfcsLevel == null) {
    throw new Error('gmfcsLevel is required when chartSet is cerebral-palsy');
  }

  const age = calculateAge(
    input.dateOfBirth,
    input.dateOfMeasurement,
    input.gestationalAgeWeeks,
    undefined,
    input.gestationalAgeDays
  );

  const effectiveAgeDays = age.correctedDays;
  const isUnder2 = effectiveAgeDays < 731;
  const isUnder5 = effectiveAgeDays < 1857;

  // Determine if we need length/height adjustment
  // Under 2: measured lying down (length). If measured standing, add 0.7 cm.
  // Over 2: measured standing (height). If measured lying down, subtract 0.7 cm.
  // For simplicity in V1, we assume correct measurement position.
  const adjustedLengthHeight = input.lengthHeight;

  const results: ZScoreResult[] = [];
  const indicatorsToCalculate: Array<{
    indicator: Indicator;
    measurement: number;
    ageInDays?: number;
    lengthHeight?: number;
  }> = [];

  // CP age range: 2-20 years only (731-7305 days)
  const cpInRange = isCp && effectiveAgeDays >= 731 && effectiveAgeDays <= 7305;

  // Weight-for-age (WHO: 0-10y; DS: 0-18y; CP: 2-20y)
  if (input.weight != null) {
    if (isCp) {
      if (cpInRange) {
        indicatorsToCalculate.push({
          indicator: 'weight-for-age',
          measurement: input.weight,
          ageInDays: effectiveAgeDays,
        });
      }
    } else {
      const wfaMaxDays = chartSet === 'down-syndrome' ? 6574 : 3650;
      if (effectiveAgeDays <= wfaMaxDays) {
        indicatorsToCalculate.push({
          indicator: 'weight-for-age',
          measurement: input.weight,
          ageInDays: effectiveAgeDays,
        });
      }
    }
  }

  // Length/Height-for-age (WHO: 0-19y; CP: 2-20y)
  if (adjustedLengthHeight != null) {
    if (isCp) {
      if (cpInRange) {
        indicatorsToCalculate.push({
          indicator: 'length-height-for-age',
          measurement: adjustedLengthHeight,
          ageInDays: effectiveAgeDays,
        });
      }
    } else {
      indicatorsToCalculate.push({
        indicator: 'length-height-for-age',
        measurement: adjustedLengthHeight,
        ageInDays: effectiveAgeDays,
      });
    }
  }

  // BMI-for-age (WHO: 0-19y; CP: 2-20y, needs both weight and height)
  if (input.weight != null && adjustedLengthHeight != null && adjustedLengthHeight > 0) {
    if (isCp) {
      if (cpInRange) {
        const heightM = adjustedLengthHeight / 100;
        const bmi = input.weight / (heightM * heightM);
        indicatorsToCalculate.push({
          indicator: 'bmi-for-age',
          measurement: Math.round(bmi * 100) / 100,
          ageInDays: effectiveAgeDays,
        });
      }
    } else {
      const heightM = adjustedLengthHeight / 100;
      const bmi = input.weight / (heightM * heightM);
      indicatorsToCalculate.push({
        indicator: 'bmi-for-age',
        measurement: Math.round(bmi * 100) / 100,
        ageInDays: effectiveAgeDays,
      });
    }
  }

  // Head circumference-for-age (WHO: 0-5y; DS: 0-20y) — not available for CP
  if (!isCp) {
    const hcfaMaxDays = chartSet === 'down-syndrome' ? 7305 : 1856;
    if (input.headCircumference != null && effectiveAgeDays <= hcfaMaxDays) {
      indicatorsToCalculate.push({
        indicator: 'head-circumference-for-age',
        measurement: input.headCircumference,
        ageInDays: effectiveAgeDays,
      });
    }
  }

  // Weight-for-length (45-110 cm, typically < 2 years) — WHO only
  if (
    chartSet === 'who-standard' &&
    input.weight != null &&
    adjustedLengthHeight != null &&
    isUnder2
  ) {
    if (adjustedLengthHeight >= 45 && adjustedLengthHeight <= 110) {
      indicatorsToCalculate.push({
        indicator: 'weight-for-length',
        measurement: input.weight,
        lengthHeight: adjustedLengthHeight,
      });
    }
  }

  // Weight-for-height (65-120 cm, typically 2-5 years) — WHO only
  if (
    chartSet === 'who-standard' &&
    input.weight != null &&
    adjustedLengthHeight != null &&
    !isUnder2 &&
    isUnder5
  ) {
    if (adjustedLengthHeight >= 65 && adjustedLengthHeight <= 120) {
      indicatorsToCalculate.push({
        indicator: 'weight-for-height',
        measurement: input.weight,
        lengthHeight: adjustedLengthHeight,
      });
    }
  }

  // Calculate all in parallel
  const calcResults = await Promise.all(
    indicatorsToCalculate.map((calc) =>
      calculateZScore({
        indicator: calc.indicator,
        sex: input.sex,
        ageInDays: calc.ageInDays,
        lengthHeight: calc.lengthHeight,
        measurement: calc.measurement,
        chartSet,
        gmfcsLevel: input.gmfcsLevel,
      })
    )
  );

  for (const result of calcResults) {
    if (result) results.push(result);
  }

  const classifications = classifyAll(results, effectiveAgeDays, chartSet, input.gmfcsLevel);

  return { age, results, classifications };
}
