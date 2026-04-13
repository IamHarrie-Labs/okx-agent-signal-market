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

const WORD_NUMS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
};

// Collapse runs of the same char: "thirrrty"→"thirty", handles obfuscated double-letters
const dedup = (s: string) => s.replace(/(.)\1+/g, '$1');

// Match an obfuscated token against known number words by comparing deduped forms
const matchWordNum = (token: string): number | undefined => {
  const dd = dedup(token);
  for (const [word, val] of Object.entries(WORD_NUMS)) {
    if (dedup(word) === dd) return val;
  }
  return undefined;
};

function parseWordNumbersFromTokens(tokens: string[]): number[] {
  const results: number[] = [];
  let i = 0, current = 0, found = false;
  while (i < tokens.length) {
    let matched = false;
    for (let w = 3; w >= 1; w--) {
      if (i + w > tokens.length) continue;
      const joined = tokens.slice(i, i + w).join('');
      const val = matchWordNum(joined);
      if (val !== undefined) {
        found = true;
        if (val === 100 || val === 1000) current = (current || 1) * val;
        else current += val;
        i += w;
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (found) { results.push(current); current = 0; found = false; }
      i++;
    }
  }
  if (found) results.push(current);
  return results;
}

function extractOperands(text: string): [number, number] {
  const parts = text.split(/\band\b/);
  if (parts.length >= 2) {
    const n1 = parseWordNumbersFromTokens(parts[0].split(/\s+/).filter(Boolean));
    const n2 = parseWordNumbersFromTokens(parts.slice(1).join(' and ').split(/\s+/).filter(Boolean));
    if (n1.length && n2.length) return [n1[n1.length - 1], n2[0]];
  }
  const all = parseWordNumbersFromTokens(text.split(/\s+/).filter(Boolean));
  return [all[0] ?? 0, all[1] ?? 0];
}

async function solveVerification(verification: {
  verification_code: string;
  challenge_text: string;
}): Promise<void> {
  if (!env.MOLTBOOK_API_KEY) return;

  const clean = verification.challenge_text
    .replace(/[\]\^\/\[\-~\{\}\|\.\,\?!<>\\]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const digitNums = clean.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  let answer = 0;
  if (digitNums.length >= 2) {
    if (clean.includes('minus') || clean.includes('subtract')) answer = digitNums[0] - digitNums[1];
    else if (clean.includes('times') || clean.includes('multiply')) answer = digitNums[0] * digitNums[1];
    else if (clean.includes('divid')) answer = digitNums[0] / digitNums[1];
    else answer = digitNums[0] + digitNums[1];
  } else {
    const [n1, n2] = extractOperands(clean);
    if (clean.includes('minus') || clean.includes('subtract')) answer = n1 - n2;
    else if (clean.includes('times') || clean.includes('multiply')) answer = n1 * n2;
    else if (clean.includes('divid')) answer = n1 / n2;
    else answer = n1 + n2;
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
