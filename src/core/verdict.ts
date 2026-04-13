/**
 * Pure verdict logic — no I/O, fully testable.
 *
 * A prediction is CORRECT if:
 *   1. Direction matches (positive bps → price went up, negative → down)
 *   2. Actual move is at least 50% of predicted magnitude (not too wrong)
 *   3. Actual move is at most 200% of predicted magnitude (not just lucky noise)
 *
 * Generous tolerance means agents aren't punished for small calibration errors.
 */

export interface VerdictInput {
  predictedBps: number;     // e.g. +200 (= +2%)
  priceAtCreation: bigint;  // scaled 1e18
  priceAtSettlement: bigint;
}

export interface VerdictOutput {
  correct: boolean;
  actualBps: number;
  predictedBps: number;
  reason: string;
}

const BPS_SCALE = 10_000n;
const PRICE_SCALE = 10n ** 18n;

export function computeVerdict(input: VerdictInput): VerdictOutput {
  const { predictedBps, priceAtCreation, priceAtSettlement } = input;

  if (priceAtCreation === 0n) {
    return { correct: false, actualBps: 0, predictedBps, reason: 'priceAtCreation is zero' };
  }

  // Actual change in basis points
  const diff = priceAtSettlement - priceAtCreation;
  const actualBpsRaw = (diff * BPS_SCALE * 100n) / (priceAtCreation * 100n);
  const actualBps = Number(actualBpsRaw);

  const predictedDir = predictedBps > 0 ? 1 : -1;
  const actualDir = actualBps > 0 ? 1 : actualBps < 0 ? -1 : 0;

  // Wrong direction
  if (actualDir !== predictedDir) {
    return {
      correct: false, actualBps, predictedBps,
      reason: `Wrong direction: predicted ${predictedBps > 0 ? 'up' : 'down'}, actual ${actualBps > 0 ? 'up' : actualBps < 0 ? 'down' : 'flat'}`,
    };
  }

  const absPredicted = Math.abs(predictedBps);
  const absActual = Math.abs(actualBps);

  // Too far off (less than 50% of predicted)
  if (absActual < absPredicted * 0.5) {
    return {
      correct: false, actualBps, predictedBps,
      reason: `Move too small: predicted ${absPredicted}bps, actual ${absActual.toFixed(1)}bps (< 50%)`,
    };
  }

  // More than 2x — considered wrong (lucky noise, not skill)
  if (absActual > absPredicted * 2) {
    return {
      correct: false, actualBps, predictedBps,
      reason: `Move too large: predicted ${absPredicted}bps, actual ${absActual.toFixed(1)}bps (> 200%)`,
    };
  }

  return {
    correct: true, actualBps, predictedBps,
    reason: `Correct: predicted ${predictedBps}bps, actual ${actualBps.toFixed(1)}bps`,
  };
}

export function scalePrice(price: number | string): bigint {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  return BigInt(Math.round(n * 1e18));
}
