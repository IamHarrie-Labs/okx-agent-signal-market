import { env } from '../util/env.js';
import { logger } from '../util/logger.js';
import type { StoredSignal } from '../core/schema.js';
import { explorerTxUrl } from './xlayer.js';
import { priceToFloat } from './uniswap.js';

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

async function moltbookPost(path: string, body: unknown): Promise<unknown> {
  if (!env.MOLTBOOK_API_KEY) {
    logger.warn('MOLTBOOK_API_KEY not set — skipping Moltbook post');
    return null;
  }
  const res = await fetch(`${MOLTBOOK_API}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.MOLTBOOK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function solveVerification(verification: {
  verification_code: string;
  challenge_text: string;
}): Promise<void> {
  if (!env.MOLTBOOK_API_KEY) return;

  // Strip obfuscation chars: ], ^, /, [, -
  const clean = verification.challenge_text.replace(/[\]\^\/\[-]/g, '').toLowerCase();
  // Extract numbers
  const nums = clean.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  let answer = 0;
  if (nums.length >= 2) {
    if (clean.includes('plus') || clean.includes('add')) answer = nums[0] + nums[1];
    else if (clean.includes('minus') || clean.includes('slow') || clean.includes('subtract')) answer = nums[0] - nums[1];
    else if (clean.includes('times') || clean.includes('multiply')) answer = nums[0] * nums[1];
    else if (clean.includes('divid')) answer = nums[0] / nums[1];
    else answer = nums[0] + nums[1]; // default to addition
  }

  await fetch(`${MOLTBOOK_API}/verify`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.MOLTBOOK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      verification_code: verification.verification_code,
      answer: answer.toFixed(2),
    }),
  });
}

/** Post signal settlement result to m/buildx. */
export async function postSettlementToMoltbook(
  signal: StoredSignal,
  oldScore: number,
  newScore: number,
): Promise<void> {
  if (!signal.settleTxHash || !signal.priceAtSettlement) return;

  const direction = signal.basisPoints > 0 ? '+' : '';
  const actualBpsStr = signal.priceAtSettlement && signal.priceAtCreation
    ? (((parseFloat(signal.priceAtSettlement) - parseFloat(signal.priceAtCreation)) / parseFloat(signal.priceAtCreation)) * 10000).toFixed(1)
    : '?';

  const content = signal.correct
    ? `Signal #${signal.id} VERIFIED ✓
Agent: ${signal.agent.slice(0, 8)}...
Called: ${signal.pair} ${direction}${signal.basisPoints}bps in ${signal.windowSeconds / 3600}h
Result: ${actualBpsStr}bps actual
Uniswap proof: ${priceToFloat(BigInt(signal.priceAtCreation)).toFixed(4)} → ${priceToFloat(BigInt(signal.priceAtSettlement)).toFixed(4)}
Rep score: ${oldScore} → ${newScore} (+10)
On-chain: ${explorerTxUrl(signal.settleTxHash)}`
    : `Signal #${signal.id} SLASHED ✗
Agent: ${signal.agent.slice(0, 8)}...
Called: ${signal.pair} ${direction}${signal.basisPoints}bps in ${signal.windowSeconds / 3600}h
Result: Wrong. Actual: ${actualBpsStr}bps
Stake burned. Rep: ${oldScore} → ${newScore} (-15)
On-chain: ${explorerTxUrl(signal.settleTxHash)}`;

  try {
    const res = await moltbookPost('/posts', {
      submolt_name: 'buildx',
      title: `Signal #${signal.id} ${signal.correct ? 'VERIFIED ✓' : 'SLASHED ✗'} — ${signal.pair}`,
      content,
    }) as { post?: { verification?: { verification_code: string; challenge_text: string } } };

    if (res?.post?.verification) {
      await solveVerification(res.post.verification);
    }
    logger.info(`Posted settlement to Moltbook for signal #${signal.id}`);
  } catch (err) {
    logger.warn('Failed to post to Moltbook', err);
  }
}
