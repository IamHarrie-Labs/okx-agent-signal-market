/**
 * okx-agent-signal-market
 *
 * Trust infrastructure for the agentic economy.
 * Every agent in crypto trusts its own signals. None of them can verify anyone else's.
 * We built the credit score layer for the agentic economy on X Layer.
 *
 * Public API surface:
 *   publishSignal(input)   — stake OKB on a price prediction
 *   settleSignal(input)    — verify outcome via Uniswap V3, update reputation
 *   queryReputation(input) — get an agent's verified track record (x402 gated)
 */

export { publishSignal, settleSignal, getAllSignals, getSignalsByAgent } from './core/signal.js';
export { buildReputationReport, buildLeaderboard } from './core/reputation.js';
export { computeVerdict, scalePrice } from './core/verdict.js';
export type {
  PublishInput, SettleInput, QueryReputationInput,
  StoredSignal, ReputationReport, PublishResult, SettleResult,
} from './core/schema.js';
export { verifyPayment } from './adapters/x402.js';
export { isLiveMode } from './util/env.js';

import { buildReputationReport } from './core/reputation.js';
import { getSignalsByAgent, getOnChainReputation } from './core/signal.js';
import { verifyPayment } from './adapters/x402.js';
import type { QueryReputationInput, ReputationReport } from './core/schema.js';
import { logger } from './util/logger.js';

/**
 * Query an agent's reputation. Requires x402 payment proof in live mode.
 */
export async function queryReputation(
  input: QueryReputationInput & { payment?: { txHash: string; from: string; amount: string } },
): Promise<ReputationReport> {
  if (input.payment) {
    await verifyPayment(input.payment);
  }

  const signals = getSignalsByAgent(input.targetAddress);
  const onChainScore = await getOnChainReputation(input.targetAddress);
  const report = buildReputationReport(input.targetAddress, signals, onChainScore);

  logger.info(`Reputation query for ${input.targetAddress}`, {
    score: report.reputationScore,
    accuracy: (report.accuracy * 100).toFixed(1) + '%',
  });

  return report;
}
