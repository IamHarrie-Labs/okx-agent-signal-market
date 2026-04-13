import type { StoredSignal, ReputationReport } from './schema.js';

export const REP_CORRECT = 10;
export const REP_WRONG = -15;

/**
 * Build a full reputation report from a list of settled signals.
 * Pure function — no I/O.
 */
export function buildReputationReport(
  address: string,
  signals: StoredSignal[],
  onChainScore: number,
): ReputationReport {
  const settled = signals.filter(s => s.status === 'settled');
  const correct = settled.filter(s => s.correct === true);
  const lastActive = settled.length > 0
    ? Math.max(...settled.map(s => s.settledAt ?? s.createdAt))
    : null;

  return {
    address,
    reputationScore: onChainScore,
    totalSignals: settled.length,
    correctSignals: correct.length,
    accuracy: settled.length > 0 ? correct.length / settled.length : 0,
    lastActive,
    recentSignals: [...settled].sort((a, b) => (b.settledAt ?? 0) - (a.settledAt ?? 0)).slice(0, 5),
  };
}

/**
 * Sort agents for leaderboard. Higher score first; ties broken by accuracy.
 */
export function buildLeaderboard(
  entries: Array<{ address: string; score: number; total: number; correct: number }>
): Array<{ rank: number; address: string; score: number; accuracy: string; signals: number }> {
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const accA = a.total > 0 ? a.correct / a.total : 0;
      const accB = b.total > 0 ? b.correct / b.total : 0;
      return accB - accA;
    })
    .map((e, i) => ({
      rank: i + 1,
      address: e.address,
      score: e.score,
      accuracy: e.total > 0 ? `${((e.correct / e.total) * 100).toFixed(1)}%` : 'n/a',
      signals: e.total,
    }));
}

/**
 * Compute expected score delta for a given verdict.
 */
export function scoreDelta(correct: boolean): number {
  return correct ? REP_CORRECT : REP_WRONG;
}
