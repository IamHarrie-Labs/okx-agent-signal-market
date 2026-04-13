import { describe, it, expect, beforeEach } from '@jest/globals';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { publishSignal, settleSignal, getAllSignals } from '../src/index.js';
import { advanceMockPrice, MOCK_PRICES } from '../src/adapters/onchainos.js';
import { getMockReputation, resetMockState } from '../src/core/signal.js';

const DATA_FILE = resolve('data/signals.json');

function fastForwardSignal(signalId: string) {
  const signals = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  const idx = signals.findIndex((s: { id: string }) => s.id === signalId);
  if (idx >= 0) {
    signals[idx].settlesAt = Date.now() - 1000;
    writeFileSync(DATA_FILE, JSON.stringify(signals, null, 2));
  }
}

beforeEach(() => {
  if (!existsSync(resolve('data'))) mkdirSync(resolve('data'), { recursive: true });
  writeFileSync(DATA_FILE, '[]');
  resetMockState();
  MOCK_PRICES['ETH/USDC'] = 3200;
});

describe('signal pipeline (mock mode)', () => {
  it('publishes a signal and stores it', async () => {
    const result = await publishSignal({
      pair: 'ETH/USDC', basisPoints: 200, windowSeconds: 300, stakeOKB: '0.001',
    });
    expect(result.signalId).toBeDefined();
    expect(result.txHash).toMatch(/^0x/);
    expect(result.priceAtCreation).toBeDefined();

    const stored = getAllSignals();
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe('pending');
  });

  it('cannot settle before window expires', async () => {
    const pub = await publishSignal({
      pair: 'ETH/USDC', basisPoints: 200, windowSeconds: 99999, stakeOKB: '0.001',
    });
    await expect(settleSignal({ signalId: pub.signalId })).rejects.toThrow(/not yet ready/);
  });

  it('settles correctly after window', async () => {
    const pub = await publishSignal({
      pair: 'ETH/USDC', basisPoints: 200, windowSeconds: 300, stakeOKB: '0.001',
    });

    advanceMockPrice('ETH/USDC', 200);
    fastForwardSignal(pub.signalId);

    const result = await settleSignal({ signalId: pub.signalId });
    expect(result.correct).toBe(true);
    expect(result.reputationDelta).toBe(10);
    expect(result.newScore).toBe(10);
  });

  it('settles wrong when direction is opposite', async () => {
    const pub = await publishSignal({
      pair: 'ETH/USDC', basisPoints: 200, windowSeconds: 300, stakeOKB: '0.001',
    });

    advanceMockPrice('ETH/USDC', -300); // went down, predicted up
    fastForwardSignal(pub.signalId);

    const result = await settleSignal({ signalId: pub.signalId });
    expect(result.correct).toBe(false);
    expect(result.reputationDelta).toBe(-15);
    expect(result.newScore).toBe(-15);
  });

  it('cannot settle same signal twice', async () => {
    const pub = await publishSignal({
      pair: 'ETH/USDC', basisPoints: 200, windowSeconds: 300, stakeOKB: '0.001',
    });
    advanceMockPrice('ETH/USDC', 200);
    fastForwardSignal(pub.signalId);
    await settleSignal({ signalId: pub.signalId });
    await expect(settleSignal({ signalId: pub.signalId })).rejects.toThrow(/already settled/);
  });

  it('reputation accumulates across multiple signals', async () => {
    const AGENT = '0xmockagent0000000000000000000000000000001';

    for (let i = 0; i < 3; i++) {
      MOCK_PRICES['ETH/USDC'] = 3200;
      const pub = await publishSignal({
        pair: 'ETH/USDC', basisPoints: 200, windowSeconds: 300, stakeOKB: '0.001',
      });
      advanceMockPrice('ETH/USDC', 200);
      fastForwardSignal(pub.signalId);
      await settleSignal({ signalId: pub.signalId });
    }

    expect(getMockReputation(AGENT)).toBe(30);
  });

  it('reputation decreases on wrong prediction', async () => {
    const AGENT = '0xmockagent0000000000000000000000000000001';

    const pub = await publishSignal({
      pair: 'ETH/USDC', basisPoints: 200, windowSeconds: 300, stakeOKB: '0.001',
    });
    advanceMockPrice('ETH/USDC', -500);
    fastForwardSignal(pub.signalId);
    await settleSignal({ signalId: pub.signalId });

    expect(getMockReputation(AGENT)).toBe(-15);
  });

  it('throws on unknown signalId', async () => {
    await expect(settleSignal({ signalId: '999' })).rejects.toThrow(/not found/);
  });

  it('meta.onchainOsCalls is present in publish result', async () => {
    const result = await publishSignal({
      pair: 'ETH/USDC', basisPoints: 100, windowSeconds: 300, stakeOKB: '0.001',
    });
    expect(typeof result.meta.onchainOsCalls).toBe('number');
  });

  it('meta.onchainOsCalls is present in settle result', async () => {
    const pub = await publishSignal({
      pair: 'ETH/USDC', basisPoints: 100, windowSeconds: 300, stakeOKB: '0.001',
    });
    advanceMockPrice('ETH/USDC', 100);
    fastForwardSignal(pub.signalId);
    const result = await settleSignal({ signalId: pub.signalId });
    expect(typeof result.meta.onchainOsCalls).toBe('number');
  });

  it('signals stored with all required fields', async () => {
    const pub = await publishSignal({
      pair: 'BTC/USDC', basisPoints: -500, windowSeconds: 600, stakeOKB: '0.01',
    });
    const stored = getAllSignals()[0];
    expect(stored.pair).toBe('BTC/USDC');
    expect(stored.basisPoints).toBe(-500);
    expect(stored.windowSeconds).toBe(600);
    expect(stored.status).toBe('pending');
    expect(stored.priceAtCreation).toBeDefined();
  });
});
