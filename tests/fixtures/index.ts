import { scalePrice } from '../../src/core/verdict.js';
import type { StoredSignal } from '../../src/core/schema.js';

export const PRICE_3200 = scalePrice(3200);
export const PRICE_3264 = scalePrice(3264); // +2% (+200bps)
export const PRICE_3136 = scalePrice(3136); // -2% (-200bps)
export const PRICE_3216 = scalePrice(3216); // +0.5% (+50bps)
export const PRICE_3248 = scalePrice(3248); // +1.5% (+150bps)
export const PRICE_3520 = scalePrice(3520); // +10% (+1000bps)

export const AGENT_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const AGENT_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

export function makeSignal(overrides: Partial<StoredSignal> = {}): StoredSignal {
  return {
    id: '0',
    agent: AGENT_A,
    pair: 'ETH/USDC',
    basisPoints: 200,
    windowSeconds: 3600,
    stakeOKBWei: '10000000000000000',
    createdAt: Date.now() - 4000000,
    settlesAt: Date.now() - 1000,
    priceAtCreation: PRICE_3200.toString(),
    txHash: '0xfixture',
    status: 'settled',
    correct: true,
    priceAtSettlement: PRICE_3264.toString(),
    settleTxHash: '0xfixture_settle',
    settledAt: Date.now() - 500,
    ...overrides,
  };
}
