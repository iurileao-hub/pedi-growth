// @pedi-growth/core — Pediatric growth calculator (WHO, Down syndrome, cerebral palsy)

// Types
export type {
  Sex,
  Indicator,
  ChartSet,
  GmfcsLevel,
  LmsRow,
  ZScoreInput,
  ZScoreResult,
  AssessmentInput,
  AssessmentResult,
  AgeResult,
  Classification,
  ClassificationSeverity,
} from './types.js';

// Calculator
export {
  calculateZScore,
  calculateAll,
  computeZScore,
  normalCdf,
  CP_AGE_LIMITS,
} from './calculator.js';

// Age utilities
export type { AgeFormatStrings } from './age.js';
export {
  ageInDays,
  correctedAgeInDays,
  formatAge,
  calculateAge,
  postMenstrualAgeDays,
} from './age.js';

// Classification
export { classify, classifyAll } from './classify.js';

// LMS lookup
export { lookupLms } from './lms.js';

// Data loading
export { loadTable, clearCache } from './data/index.js';
