import type { AgeResult } from './types.js';

/** Number of milliseconds in a day */
const MS_PER_DAY = 86_400_000;

/** Weeks of a full-term pregnancy */
const FULL_TERM_WEEKS = 40;

/** Prematurity correction cutoff: 2 years in days (730.5, rounded to 731) */
const CORRECTION_CUTOFF_DAYS = 731;

/**
 * Calculate post-menstrual age in days.
 * PMA = gestational age at birth (in days) + chronological age (in days)
 */
export function postMenstrualAgeDays(
  chronologicalDays: number,
  gestationalAgeWeeks: number,
  gestationalAgeDays?: number
): number {
  return gestationalAgeWeeks * 7 + (gestationalAgeDays ?? 0) + chronologicalDays;
}

/**
 * Calculate age in days between two dates (ignoring time-of-day).
 * Uses UTC to avoid timezone/DST issues.
 */
export function ageInDays(dateOfBirth: Date, dateOfMeasurement: Date): number {
  const birthUTC = Date.UTC(
    dateOfBirth.getFullYear(),
    dateOfBirth.getMonth(),
    dateOfBirth.getDate()
  );
  const measureUTC = Date.UTC(
    dateOfMeasurement.getFullYear(),
    dateOfMeasurement.getMonth(),
    dateOfMeasurement.getDate()
  );
  return Math.floor((measureUTC - birthUTC) / MS_PER_DAY);
}

/**
 * Calculate corrected age for premature infants.
 * Correction = (40 weeks in days) - (gestational age in days)
 * Applied only when chronological age < 2 years (731 days).
 */
export function correctedAgeInDays(
  chronologicalDays: number,
  gestationalAgeWeeks?: number,
  gestationalAgeDays?: number
): number {
  if (
    gestationalAgeWeeks == null ||
    gestationalAgeWeeks >= 37 ||
    chronologicalDays >= CORRECTION_CUTOFF_DAYS
  ) {
    return chronologicalDays;
  }
  const gaDays = gestationalAgeWeeks * 7 + (gestationalAgeDays ?? 0);
  const correctionDays = FULL_TERM_WEEKS * 7 - gaDays;
  return Math.max(0, chronologicalDays - correctionDays);
}

/** Age formatting strings (for consumer-supplied translations) */
export interface AgeFormatStrings {
  years: (n: number) => string;
  months: (n: number) => string;
  days: (n: number) => string;
  and: string;
}

/** Default English age formatting strings */
const defaultAgeStrings: AgeFormatStrings = {
  years: (n) => (n === 1 ? '1 year' : `${n} years`),
  months: (n) => (n === 1 ? '1 month' : `${n} months`),
  days: (n) => (n === 1 ? '1 day' : `${n} days`),
  and: 'and',
};

/**
 * Format age as a human-readable string.
 * - < 1 month: days only
 * - < 2 years: months and days
 * - >= 2 years: years and months
 *
 * Pass custom `strings` to localize output; defaults to English.
 */
export function formatAge(days: number, strings?: AgeFormatStrings): string {
  const s = strings ?? defaultAgeStrings;
  if (days < 0) return s.days(0);

  const totalMonths = Math.floor(days / 30.4375);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const remainingDays = Math.max(0, Math.floor(days - totalMonths * 30.4375));

  if (days < 31) {
    return s.days(days);
  }

  if (totalMonths < 24) {
    if (remainingDays > 0) {
      return `${s.months(totalMonths)} ${s.and} ${s.days(remainingDays)}`;
    }
    return s.months(totalMonths);
  }

  if (months > 0) {
    return `${s.years(years)} ${s.and} ${s.months(months)}`;
  }
  return s.years(years);
}

/**
 * Calculate full age information including prematurity correction.
 *
 * Pass custom `strings` to localize the formatted age; defaults to English.
 */
export function calculateAge(
  dateOfBirth: Date,
  dateOfMeasurement: Date,
  gestationalAgeWeeks?: number,
  strings?: AgeFormatStrings,
  gestationalAgeDays?: number
): AgeResult {
  const chronologicalDays = ageInDays(dateOfBirth, dateOfMeasurement);
  const correctedDays = correctedAgeInDays(
    chronologicalDays,
    gestationalAgeWeeks,
    gestationalAgeDays
  );
  const isCorrected = correctedDays !== chronologicalDays;

  return {
    chronologicalDays,
    correctedDays,
    isCorrected,
    formatted: formatAge(chronologicalDays, strings),
    formattedCorrected: isCorrected ? formatAge(correctedDays, strings) : undefined,
  };
}
