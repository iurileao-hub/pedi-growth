import type {
  ZScoreResult,
  Classification,
  ClassificationSeverity,
  Indicator,
  ChartSet,
  GmfcsLevel,
} from './types.js';
import { normalCdf } from './gaussian.js';

/**
 * SISVAN/WHO classification cutpoints by indicator.
 *
 * Weight-for-age (0-10 years):
 *   < -3: Very low weight for age
 *   -3 to < -2: Low weight for age
 *   -2 to +2: Adequate weight for age
 *   > +2: High weight for age
 *
 * Length/Height-for-age (0-19 years):
 *   < -3: Very low stature for age
 *   -3 to < -2: Low stature for age
 *   >= -2: Adequate stature for age
 *
 * BMI-for-age:
 *   0-5 years:
 *     < -3: Severe wasting
 *     -3 to < -2: Wasting
 *     -2 to +1: Normal weight
 *     +1 to +2: Risk of overweight
 *     +2 to +3: Overweight
 *     > +3: Obesity
 *   5-19 years:
 *     < -3: Severe thinness
 *     -3 to < -2: Thinness
 *     -2 to +1: Normal weight
 *     +1 to +2: Overweight
 *     +2 to +3: Obesity
 *     > +3: Severe obesity
 *
 * Weight-for-length/height (0-5 years):
 *   Same as BMI 0-5 years
 *
 * Head circumference-for-age:
 *   < -2: Below expected
 *   -2 to +2: Adequate
 *   > +2: Above expected
 */

interface CutpointDef {
  maxZ: number;
  severity: ClassificationSeverity;
}

const WFA_CUTPOINTS: CutpointDef[] = [
  { maxZ: -3, severity: 'very-low' },
  { maxZ: -2, severity: 'low' },
  { maxZ: 2, severity: 'adequate' },
  { maxZ: Infinity, severity: 'high' },
];

const LHFA_CUTPOINTS: CutpointDef[] = [
  { maxZ: -3, severity: 'very-low' },
  { maxZ: -2, severity: 'low' },
  { maxZ: Infinity, severity: 'adequate' },
];

const BMI_0_5_CUTPOINTS: CutpointDef[] = [
  { maxZ: -3, severity: 'very-low' },
  { maxZ: -2, severity: 'low' },
  { maxZ: 1, severity: 'adequate' },
  { maxZ: 2, severity: 'risk' },
  { maxZ: 3, severity: 'high' },
  { maxZ: Infinity, severity: 'very-high' },
];

const BMI_5_19_CUTPOINTS: CutpointDef[] = [
  { maxZ: -3, severity: 'very-low' },
  { maxZ: -2, severity: 'low' },
  { maxZ: 1, severity: 'adequate' },
  { maxZ: 2, severity: 'high' },
  { maxZ: Infinity, severity: 'very-high' }, // z > +2: Obesity (z 2-3) and Severe obesity (z > 3) share severity code; label differs via BMI_5_19_LABELS
];

const HC_CUTPOINTS: CutpointDef[] = [
  { maxZ: -2, severity: 'low' },
  { maxZ: 2, severity: 'adequate' },
  { maxZ: Infinity, severity: 'high' },
];

function classifyByZ(z: number, cutpoints: CutpointDef[]): ClassificationSeverity {
  for (const cp of cutpoints) {
    if (z < cp.maxZ) return cp.severity;
  }
  return cutpoints[cutpoints.length - 1].severity;
}

function getCutpoints(indicator: Indicator, ageInDays: number): CutpointDef[] {
  switch (indicator) {
    case 'weight-for-age':
      return WFA_CUTPOINTS;
    case 'length-height-for-age':
      return LHFA_CUTPOINTS;
    case 'bmi-for-age':
      return ageInDays < 1857 ? BMI_0_5_CUTPOINTS : BMI_5_19_CUTPOINTS;
    case 'weight-for-length':
    case 'weight-for-height':
      return BMI_0_5_CUTPOINTS;
    case 'head-circumference-for-age':
      return HC_CUTPOINTS;
    default: {
      const _exhaustive: never = indicator;
      throw new Error(`Unknown indicator: ${_exhaustive}`);
    }
  }
}

/** English labels by indicator and severity (fallback for consumers) */
const LABELS: Record<Indicator, Partial<Record<ClassificationSeverity, string>>> = {
  'weight-for-age': {
    'very-low': 'Very low weight for age',
    low: 'Low weight for age',
    adequate: 'Adequate weight for age',
    high: 'High weight for age',
  },
  'length-height-for-age': {
    'very-low': 'Very low stature for age',
    low: 'Low stature for age',
    adequate: 'Adequate stature for age',
  },
  'bmi-for-age': {
    'very-low': 'Severe wasting',
    low: 'Wasting',
    adequate: 'Normal weight',
    risk: 'Risk of overweight',
    high: 'Overweight',
    'very-high': 'Obesity',
  },
  'weight-for-length': {
    'very-low': 'Severe wasting',
    low: 'Wasting',
    adequate: 'Normal weight',
    risk: 'Risk of overweight',
    high: 'Overweight',
    'very-high': 'Obesity',
  },
  'weight-for-height': {
    'very-low': 'Severe wasting',
    low: 'Wasting',
    adequate: 'Normal weight',
    risk: 'Risk of overweight',
    high: 'Overweight',
    'very-high': 'Obesity',
  },
  'head-circumference-for-age': {
    low: 'Below expected',
    adequate: 'Adequate',
    high: 'Above expected',
  },
};

/** 5-19 BMI specific labels */
const BMI_5_19_LABELS: Partial<Record<ClassificationSeverity, string>> = {
  'very-low': 'Severe thinness',
  low: 'Thinness',
  adequate: 'Normal weight',
  high: 'Overweight',
  'very-high': 'Severe obesity',
};

/**
 * CP weight-for-age classification (Brooks 2011).
 *
 * GMFCS I-II: < P5 = underweight (increased risk), P5-P10 = borderline, >= P10 = adequate
 * GMFCS III-V: < P10 = underweight (increased risk), P10-P20 = borderline, >= P20 = adequate
 */
function classifyCpWeight(zScore: number, gmfcsLevel: GmfcsLevel): Classification {
  const percentile = normalCdf(zScore) * 100;
  // GMFCS I-II use lower percentile cutoffs (P5/P10) vs III-V (P10/P20)
  const isGmfcsLow = gmfcsLevel === 1 || gmfcsLevel === 2;

  let severity: ClassificationSeverity;
  let label: string;

  if (isGmfcsLow) {
    // GMFCS I-II
    if (percentile < 5) {
      severity = 'very-low';
      label = 'Underweight (increased risk)';
    } else if (percentile < 10) {
      severity = 'low';
      label = 'Borderline weight';
    } else {
      severity = 'adequate';
      label = 'Adequate weight';
    }
  } else {
    // GMFCS III-V
    if (percentile < 10) {
      severity = 'very-low';
      label = 'Underweight (increased risk)';
    } else if (percentile < 20) {
      severity = 'low';
      label = 'Borderline weight';
    } else {
      severity = 'adequate';
      label = 'Adequate weight';
    }
  }

  return { indicator: 'weight-for-age', severity, label };
}

/** Generic z-score classification for CP height/BMI (< -2, -2 to +2, > +2) */
function classifyCpGeneric(result: ZScoreResult): Classification {
  let severity: ClassificationSeverity;
  let label: string;

  if (result.zScore < -2) {
    severity = 'low';
    label = result.indicator === 'length-height-for-age' ? 'Low stature for age' : 'Below expected';
  } else if (result.zScore <= 2) {
    severity = 'adequate';
    label = result.indicator === 'length-height-for-age' ? 'Adequate stature for age' : 'Adequate';
  } else {
    severity = 'high';
    label =
      result.indicator === 'length-height-for-age' ? 'High stature for age' : 'Above expected';
  }

  return { indicator: result.indicator, severity, label };
}

/**
 * Classify a single z-score result.
 *
 * Returns a severity code and an English fallback label.
 * Consumers should use `severity` for their own localized labels.
 */
export function classify(
  result: ZScoreResult,
  ageInDays: number,
  chartSet?: ChartSet,
  gmfcsLevel?: GmfcsLevel
): Classification {
  // CP-specific classification
  if (chartSet === 'cerebral-palsy' && gmfcsLevel != null) {
    if (result.indicator === 'weight-for-age') {
      return classifyCpWeight(result.zScore, gmfcsLevel);
    }
    return classifyCpGeneric(result);
  }

  const cutpoints = getCutpoints(result.indicator, ageInDays);
  const severity = classifyByZ(result.zScore, cutpoints);

  // Use specific labels for BMI 5-19
  let label: string;
  if (result.indicator === 'bmi-for-age' && ageInDays >= 1857) {
    label = BMI_5_19_LABELS[severity] ?? severity;
  } else {
    label = LABELS[result.indicator][severity] ?? severity;
  }

  return {
    indicator: result.indicator,
    severity,
    label,
  };
}

/**
 * Classify all z-score results.
 */
export function classifyAll(
  results: ZScoreResult[],
  ageInDays: number,
  chartSet?: ChartSet,
  gmfcsLevel?: GmfcsLevel
): Classification[] {
  return results.map((r) => classify(r, ageInDays, chartSet, gmfcsLevel));
}
