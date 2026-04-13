import { describe, it, expect } from '@jest/globals';
import { buildReputationReport, buildLeaderboard, scoreDelta } from '../src/core/reputation.js';
import { makeSignal, AGENT_A, AGENT_B } from './fixtures/index.js';

describe('scoreDelta', () => {
  it('returns +10 for correct', () => expect(scoreDelta(true)).toBe(10));
  it('returns -15 for wrong', () => expect(scoreDelta(false)).toBe(-15));
});

describe('buildReputationReport', () => {
  it('cold-start agent shows zero score and no signals', () => {
    const report = buildReputationReport(AGENT_A, [], 0);
    expect(report.reputationScore).toBe(0);
    expect(report.totalSignals).toBe(0);
    expect(report.correctSignals).toBe(0);
    expect(report.accuracy).toBe(0);
    expect(report.lastActive).toBeNull();
  });

  it('single correct signal', () => {
    const signals = [makeSignal({ agent: AGENT_A, correct: true })];
    const report = buildReputationReport(AGENT_A, signals, 10);
    expect(report.totalSignals).toBe(1);
    expect(report.correctSignals).toBe(1);
    expect(report.accuracy).toBe(1);
  });

  it('multiple correct signals build score', () => {
    const signals = [
      makeSignal({ agent: AGENT_A, id: '0', correct: true }),
      makeSignal({ agent: AGENT_A, id: '1', correct: true }),
      makeSignal({ agent: AGENT_A, id: '2', correct: true }),
    ];
    const report = buildReputationReport(AGENT_A, signals, 30);
    expect(report.totalSignals).toBe(3);
    expect(report.accuracy).toBe(1);
  });

  it('slashing reduces score', () => {
    const signals = [
      makeSignal({ id: '0', correct: true }),
      makeSignal({ id: '1', correct: false }),
    ];
    const report = buildReputationReport(AGENT_A, signals, -5); // 10 - 15 = -5
    expect(report.reputationScore).toBe(-5);
    expect(report.accuracy).toBeCloseTo(0.5);
  });

  it('only counts settled signals', () => {
    const signals = [
      makeSignal({ id: '0', status: 'pending' }),
      makeSignal({ id: '1', status: 'settled', correct: true }),
    ];
    const report = buildReputationReport(AGENT_A, signals, 10);
    expect(report.totalSignals).toBe(1);
  });

  it('recentSignals sorted newest first', () => {
    const signals = [
      makeSignal({ id: '0', settledAt: 1000 }),
      makeSignal({ id: '1', settledAt: 3000 }),
      makeSignal({ id: '2', settledAt: 2000 }),
    ];
    const report = buildReputationReport(AGENT_A, signals, 30);
    expect(report.recentSignals[0].id).toBe('1');
    expect(report.recentSignals[1].id).toBe('2');
  });
});

describe('buildLeaderboard', () => {
  it('sorts by score descending', () => {
    const entries = [
      { address: AGENT_A, score: 10, total: 2, correct: 1 },
      { address: AGENT_B, score: 30, total: 3, correct: 3 },
    ];
    const board = buildLeaderboard(entries);
    expect(board[0].address).toBe(AGENT_B);
    expect(board[0].rank).toBe(1);
  });

  it('breaks ties by accuracy', () => {
    const entries = [
      { address: AGENT_A, score: 10, total: 10, correct: 2 }, // 20%
      { address: AGENT_B, score: 10, total: 2, correct: 2 },  // 100%
    ];
    const board = buildLeaderboard(entries);
    expect(board[0].address).toBe(AGENT_B);
  });

  it('formats accuracy as percentage', () => {
    const entries = [{ address: AGENT_A, score: 10, total: 4, correct: 3 }];
    const board = buildLeaderboard(entries);
    expect(board[0].accuracy).toBe('75.0%');
  });

  it('shows n/a accuracy for zero signals', () => {
    const entries = [{ address: AGENT_A, score: 0, total: 0, correct: 0 }];
    const board = buildLeaderboard(entries);
    expect(board[0].accuracy).toBe('n/a');
  });
});
