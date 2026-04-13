import { describe, it, expect } from '@jest/globals';
import { computeVerdict, scalePrice } from '../src/core/verdict.js';
import { PRICE_3200, PRICE_3264, PRICE_3136, PRICE_3216, PRICE_3248, PRICE_3520 } from './fixtures/index.js';

describe('computeVerdict', () => {
  it('correct: exact upward prediction', () => {
    const v = computeVerdict({ predictedBps: 200, priceAtCreation: PRICE_3200, priceAtSettlement: PRICE_3264 });
    expect(v.correct).toBe(true);
  });

  it('correct: downward prediction matched', () => {
    const v = computeVerdict({ predictedBps: -200, priceAtCreation: PRICE_3200, priceAtSettlement: PRICE_3136 });
    expect(v.correct).toBe(true);
  });

  it('correct: within 50%-200% tolerance (1.5x)', () => {
    // Predicted +200bps, actual ~+150bps (75% of predicted — inside tolerance)
    const v = computeVerdict({ predictedBps: 200, priceAtCreation: PRICE_3200, priceAtSettlement: PRICE_3248 });
    expect(v.correct).toBe(true);
  });

  it('wrong: right direction but move too small (< 50%)', () => {
    // Predicted +200bps, actual +50bps (25% of predicted)
    const v = computeVerdict({ predictedBps: 200, priceAtCreation: PRICE_3200, priceAtSettlement: PRICE_3216 });
    expect(v.correct).toBe(false);
    expect(v.reason).toMatch(/too small/);
  });

  it('wrong: right direction but move too large (> 200%)', () => {
    // Predicted +200bps, actual +1000bps (5x)
    const v = computeVerdict({ predictedBps: 200, priceAtCreation: PRICE_3200, priceAtSettlement: PRICE_3520 });
    expect(v.correct).toBe(false);
    expect(v.reason).toMatch(/too large/);
  });

  it('wrong: completely wrong direction (predicted up, went down)', () => {
    const v = computeVerdict({ predictedBps: 200, priceAtCreation: PRICE_3200, priceAtSettlement: PRICE_3136 });
    expect(v.correct).toBe(false);
    expect(v.reason).toMatch(/Wrong direction/);
  });

  it('wrong: predicted down, went up', () => {
    const v = computeVerdict({ predictedBps: -200, priceAtCreation: PRICE_3200, priceAtSettlement: PRICE_3264 });
    expect(v.correct).toBe(false);
  });

  it('wrong: zero priceAtCreation', () => {
    const v = computeVerdict({ predictedBps: 200, priceAtCreation: 0n, priceAtSettlement: PRICE_3264 });
    expect(v.correct).toBe(false);
  });

  it('returns actualBps in verdict', () => {
    const v = computeVerdict({ predictedBps: 200, priceAtCreation: PRICE_3200, priceAtSettlement: PRICE_3264 });
    expect(v.actualBps).toBeCloseTo(200, 0);
  });

  it('scalePrice converts number to bigint correctly', () => {
    const scaled = scalePrice(3200);
    expect(scaled).toBe(PRICE_3200);
  });

  it('scalePrice handles string input', () => {
    expect(scalePrice('3200')).toBe(scalePrice(3200));
  });
});
