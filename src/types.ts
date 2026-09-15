/** Biological sex */
export type Sex = 'male' | 'female';

/** Growth indicator type */
export type Indicator =
  | 'weight-for-age'
  | 'length-height-for-age'
  | 'bmi-for-age'
  | 'head-circumference-for-age'
  | 'weight-for-length'
  | 'weight-for-height';

/** Growth chart reference set */
export type ChartSet = 'who-standard' | 'down-syndrome' | 'cerebral-palsy';

/** Gross Motor Function Classification System level for cerebral palsy charts */
export type GmfcsLevel = 1 | 2 | 3 | 4 | '5-oral' | '5-tube';

/** A single row from an LMS table */
export interface LmsRow {
  /** Age in days (0-5y tables) or months (5-19y tables), or length/height in cm (weight-for-length/height) */
  age: number;
  /** Box-Cox power (L) */
  L: number;
  /** Median (M) */
  M: number;
  /** Coefficient of variation (S) */
  S: number;
}

/** Input for a single z-score calculation */
export interface ZScoreInput {
  indicator: Indicator;
  sex: Sex;
  /** Age in days (for age-based indicators) */
  ageInDays?: number;
  /** Length or height in cm (for weight-for-length/height) */
  lengthHeight?: number;
  /** The measured value */
  measurement: number;
  /** Chart set to use (defaults to 'who-standard') */
  chartSet?: ChartSet;
  /** Gestational age in weeks (for prematurity correction) */
  gestationalAgeWeeks?: number;
  /** Gestational age days component (0–6, added to weeks) */
  gestationalAgeDays?: number;
  /** GMFCS level (required when chartSet is 'cerebral-palsy') */
  gmfcsLevel?: GmfcsLevel;
}

/** Input for a full assessment */
export interface AssessmentInput {
  sex: Sex;
  dateOfBirth: Date;
  dateOfMeasurement: Date;
  weight?: number;
  lengthHeight?: number;
  headCircumference?: number;
  /** Gestational age in weeks at birth (< 37 = premature) */
  gestationalAgeWeeks?: number;
  /** Gestational age days component (0–6, added to weeks) */
  gestationalAgeDays?: number;
  /** Chart set to use for calculations (defaults to 'who-standard') */
  chartSet?: ChartSet;
  /** GMFCS level (required when chartSet is 'cerebral-palsy') */
  gmfcsLevel?: GmfcsLevel;
}

/** Result of a z-score calculation */
export interface ZScoreResult {
  indicator: Indicator;
  zScore: number;
  percentile: number;
}

/** Nutritional classification severity */
export type ClassificationSeverity =
  | 'very-low'
  | 'low'
  | 'adequate'
  | 'risk'
  | 'high'
  | 'very-high';

/** Nutritional classification for a single indicator */
export interface Classification {
  indicator: Indicator;
  severity: ClassificationSeverity;
  label: string;
}

/** Age information */
export interface AgeResult {
  /** Chronological age in days */
  chronologicalDays: number;
  /** Corrected age in days (equals chronological if not premature) */
  correctedDays: number;
  /** Whether prematurity correction was applied */
  isCorrected: boolean;
  /** Formatted chronological age */
  formatted: string;
  /** Formatted corrected age (if different from chronological) */
  formattedCorrected?: string;
}

/** Full assessment result */
export interface AssessmentResult {
  age: AgeResult;
  results: ZScoreResult[];
  classifications: Classification[];
}
