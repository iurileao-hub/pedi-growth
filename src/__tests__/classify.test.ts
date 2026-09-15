import { describe, it, expect } from 'vitest';
import { classify } from '../classify.js';
import type { ZScoreResult } from '../types.js';

describe('classify', () => {
  describe('weight-for-age', () => {
    const makeResult = (z: number): ZScoreResult => ({
      indicator: 'weight-for-age',
      zScore: z,
      percentile: 50,
    });

    it('classifies very low weight (z < -3)', () => {
      const c = classify(makeResult(-3.5), 365);
      expect(c.severity).toBe('very-low');
      expect(c.label).toBe('Very low weight for age');
    });

    it('classifies low weight (-3 <= z < -2)', () => {
      const c = classify(makeResult(-2.5), 365);
      expect(c.severity).toBe('low');
      expect(c.label).toBe('Low weight for age');
    });

    it('classifies adequate weight (-2 <= z <= +2)', () => {
      const c = classify(makeResult(0), 365);
      expect(c.severity).toBe('adequate');
      expect(c.label).toBe('Adequate weight for age');
    });

    it('classifies elevated weight (z > +2)', () => {
      const c = classify(makeResult(2.5), 365);
      expect(c.severity).toBe('high');
      expect(c.label).toBe('High weight for age');
    });
  });

  describe('length-height-for-age', () => {
    const makeResult = (z: number): ZScoreResult => ({
      indicator: 'length-height-for-age',
      zScore: z,
      percentile: 50,
    });

    it('classifies very low height (z < -3)', () => {
      const c = classify(makeResult(-3.5), 365);
      expect(c.severity).toBe('very-low');
    });

    it('classifies low height (-3 <= z < -2)', () => {
      const c = classify(makeResult(-2.5), 365);
      expect(c.severity).toBe('low');
    });

    it('classifies adequate height (z >= -2)', () => {
      const c = classify(makeResult(0), 365);
      expect(c.severity).toBe('adequate');
      // Even high values are adequate for height
      const c2 = classify(makeResult(3), 365);
      expect(c2.severity).toBe('adequate');
    });
  });

  describe('bmi-for-age 0-5 years', () => {
    const age = 365; // 1 year
    const makeResult = (z: number): ZScoreResult => ({
      indicator: 'bmi-for-age',
      zScore: z,
      percentile: 50,
    });

    it('classifies severe thinness (z < -3)', () => {
      const c = classify(makeResult(-3.5), age);
      expect(c.severity).toBe('very-low');
      expect(c.label).toBe('Severe wasting');
    });

    it('classifies thinness (-3 <= z < -2)', () => {
      const c = classify(makeResult(-2.5), age);
      expect(c.severity).toBe('low');
      expect(c.label).toBe('Wasting');
    });

    it('classifies adequate (-2 <= z <= +1)', () => {
      const c = classify(makeResult(0), age);
      expect(c.severity).toBe('adequate');
      expect(c.label).toBe('Normal weight');
    });

    it('classifies overweight risk (+1 < z <= +2)', () => {
      const c = classify(makeResult(1.5), age);
      expect(c.severity).toBe('risk');
      expect(c.label).toBe('Risk of overweight');
    });

    it('classifies overweight (+2 < z <= +3)', () => {
      const c = classify(makeResult(2.5), age);
      expect(c.severity).toBe('high');
      expect(c.label).toBe('Overweight');
    });

    it('classifies obesity (z > +3)', () => {
      const c = classify(makeResult(3.5), age);
      expect(c.severity).toBe('very-high');
      expect(c.label).toBe('Obesity');
    });
  });

  describe('bmi-for-age 5-19 years', () => {
    const age = 2000; // ~5.5 years
    const makeResult = (z: number): ZScoreResult => ({
      indicator: 'bmi-for-age',
      zScore: z,
      percentile: 50,
    });

    it('classifies overweight (+1 < z <= +2)', () => {
      const c = classify(makeResult(1.5), age);
      expect(c.severity).toBe('high');
      expect(c.label).toBe('Overweight');
    });

    it('classifies obesity (+2 < z <= +3)', () => {
      const c = classify(makeResult(2.5), age);
      expect(c.severity).toBe('very-high');
      expect(c.label).toBe('Severe obesity');
    });

    it('classifies severe obesity (z > +3)', () => {
      const c = classify(makeResult(3.5), age);
      expect(c.severity).toBe('very-high');
    });
  });

  describe('head-circumference-for-age', () => {
    const makeResult = (z: number): ZScoreResult => ({
      indicator: 'head-circumference-for-age',
      zScore: z,
      percentile: 50,
    });

    it('classifies below expected (z < -2)', () => {
      const c = classify(makeResult(-2.5), 365);
      expect(c.severity).toBe('low');
    });

    it('classifies adequate (-2 <= z <= +2)', () => {
      const c = classify(makeResult(0), 365);
      expect(c.severity).toBe('adequate');
    });

    it('classifies above expected (z > +2)', () => {
      const c = classify(makeResult(2.5), 365);
      expect(c.severity).toBe('high');
    });
  });
});
