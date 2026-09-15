import { describe, it, expect } from 'vitest';
import { ageInDays, correctedAgeInDays, formatAge, postMenstrualAgeDays } from '../age.js';

const strings = {
  years: (n: number) => (n === 1 ? '1 ano' : `${n} anos`),
  months: (n: number) => (n === 1 ? '1 mês' : `${n} meses`),
  days: (n: number) => (n === 1 ? '1 dia' : `${n} dias`),
  and: 'e',
};

describe('ageInDays', () => {
  it('calculates age for same day as 0', () => {
    const dob = new Date('2024-01-15');
    const dom = new Date('2024-01-15');
    expect(ageInDays(dob, dom)).toBe(0);
  });

  it('calculates age for 1 day', () => {
    const dob = new Date('2024-01-15');
    const dom = new Date('2024-01-16');
    expect(ageInDays(dob, dom)).toBe(1);
  });

  it('calculates age for 1 year', () => {
    const dob = new Date('2024-01-15');
    const dom = new Date('2025-01-15');
    expect(ageInDays(dob, dom)).toBe(366); // 2024 is a leap year
  });

  it('calculates age for 1 non-leap year', () => {
    const dob = new Date('2023-01-15');
    const dom = new Date('2024-01-15');
    expect(ageInDays(dob, dom)).toBe(365);
  });

  it('handles leap year crossing', () => {
    const dob = new Date('2024-02-28');
    const dom = new Date('2024-03-01');
    expect(ageInDays(dob, dom)).toBe(2); // Feb 28 -> Feb 29 -> Mar 1
  });

  it('returns negative for future birth date', () => {
    const dob = new Date('2025-01-15');
    const dom = new Date('2024-01-15');
    expect(ageInDays(dob, dom)).toBeLessThan(0);
  });
});

describe('correctedAgeInDays', () => {
  it('returns chronological age when not premature', () => {
    expect(correctedAgeInDays(365, undefined)).toBe(365);
  });

  it('returns chronological age when >= 37 weeks', () => {
    expect(correctedAgeInDays(365, 37)).toBe(365);
    expect(correctedAgeInDays(365, 40)).toBe(365);
  });

  it('corrects for 34 weeks gestation', () => {
    // Correction = (40 - 34) * 7 = 42 days
    expect(correctedAgeInDays(100, 34)).toBe(58);
  });

  it('corrects for 28 weeks gestation', () => {
    // Correction = (40 - 28) * 7 = 84 days
    expect(correctedAgeInDays(200, 28)).toBe(116);
  });

  it('does not correct after 2 years (731 days)', () => {
    expect(correctedAgeInDays(731, 34)).toBe(731);
    expect(correctedAgeInDays(800, 34)).toBe(800);
  });

  it('does not go below 0 days', () => {
    // Correction = (40 - 24) * 7 = 112 days, but chrono is only 50
    expect(correctedAgeInDays(50, 24)).toBe(0);
  });

  it('corrects for 32 weeks + 3 days gestation', () => {
    // Correction = 40*7 - (32*7 + 3) = 280 - 227 = 53 days
    expect(correctedAgeInDays(100, 32, 3)).toBe(47);
  });

  it('corrects for 34 weeks + 5 days gestation', () => {
    // Correction = 280 - (34*7 + 5) = 280 - 243 = 37 days
    expect(correctedAgeInDays(100, 34, 5)).toBe(63);
  });

  it('corrects for weeks-only vs weeks+days differently', () => {
    // 32+0 → correction = 56 days
    expect(correctedAgeInDays(100, 32, 0)).toBe(44);
    // 32+6 → correction = 50 days (6 fewer)
    expect(correctedAgeInDays(100, 32, 6)).toBe(50);
    // Difference should be exactly 6 days
    expect(correctedAgeInDays(100, 32, 6) - correctedAgeInDays(100, 32, 0)).toBe(6);
  });

  it('treats undefined days the same as 0 days', () => {
    expect(correctedAgeInDays(100, 34)).toBe(correctedAgeInDays(100, 34, 0));
    expect(correctedAgeInDays(100, 34)).toBe(correctedAgeInDays(100, 34, undefined));
  });
});

describe('formatAge', () => {
  it('formats days for very young infants', () => {
    expect(formatAge(0, strings)).toBe('0 dias');
    expect(formatAge(1, strings)).toBe('1 dia');
    expect(formatAge(15, strings)).toBe('15 dias');
    expect(formatAge(30, strings)).toBe('30 dias');
  });

  it('formats months and days', () => {
    const result = formatAge(45, strings);
    expect(result).toContain('mês');
  });

  it('formats years and months for older children', () => {
    const result = formatAge(365 * 3, strings); // ~3 years
    expect(result).toContain('ano');
  });

  it('handles negative days', () => {
    expect(formatAge(-5, strings)).toBe('0 dias');
  });
});

describe('postMenstrualAgeDays', () => {
  it('calculates PMA for 32-week preterm at 14 days old', () => {
    // PMA = (32 * 7) + 14 = 238 days
    expect(postMenstrualAgeDays(14, 32)).toBe(238);
  });

  it('calculates PMA for term infant at birth', () => {
    // PMA = (40 * 7) + 0 = 280 days
    expect(postMenstrualAgeDays(0, 40)).toBe(280);
  });

  it('calculates PMA for 28-week preterm at 84 days (40w PMA)', () => {
    // PMA = (28 * 7) + 84 = 280 days = 40 weeks
    expect(postMenstrualAgeDays(84, 28)).toBe(280);
  });

  it('calculates PMA with gestational age days component', () => {
    // PMA = (32 * 7 + 4) + 14 = 228 + 14 = 242 days
    expect(postMenstrualAgeDays(14, 32, 4)).toBe(242);
  });

  it('treats undefined days as 0 in PMA', () => {
    expect(postMenstrualAgeDays(14, 32)).toBe(postMenstrualAgeDays(14, 32, 0));
  });
});
