/**
 * Standard normal CDF approximation (Abramowitz & Stegun, formula 26.2.17).
 * Maximum error: 7.5e-8.
 */
export function normalCdf(z: number): number {
  if (z < -12) return 0;
  if (z > 12) return 1;

  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989422804014327; // 1/sqrt(2*PI)
  const p =
    d *
    Math.exp((-absZ * absZ) / 2) *
    (t *
      (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))));

  return z > 0 ? 1 - p : p;
}
