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
const dedup = (s: string) => s.replace(/(.)\1+/g, '$1');

// Exact dedup match
function matchExact(s: string): number | undefined {
  const dd = dedup(s);
  for (const [w, v] of Object.entries(WORD_NUMS)) if (dedup(w) === dd) return v;
  return undefined;
}
// Targeted substitution: h→u (handles fohrteen→fourteen)
function matchWithSubs(s: string): number | undefined {
  const exact = matchExact(s);
  if (exact !== undefined) return exact;
  return matchExact(dedup(s).replace(/h/g, 'u'));
}

function parseAllNumbers(tokens: string[]): number[] {
  const r: number[] = [];
  let i = 0, cur = 0, found = false, noise = 0;
  while (i < tokens.length) {
    let ok = false;
    // 1. Full-join windows 3→1
    for (let w = 3; w >= 1 && !ok; w--) {
      if (i + w > tokens.length) continue;
      const v = matchExact(tokens.slice(i, i + w).join(''));
      if (v !== undefined) { found = true; noise = 0; if (v === 100 || v === 1000) cur = (cur || 1) * v; else cur += v; i += w; ok = true; }
    }
    // 2. Suffix-join window=2: last K chars of tokens[i] + tokens[i+1]
    if (!ok && i + 1 < tokens.length) {
      const t1 = tokens[i], t2 = tokens[i + 1];
      for (let k = 1; k < t1.length && !ok; k++) {
        const v = matchExact(t1.slice(-k) + t2);
        if (v !== undefined) { found = true; noise = 0; if (v === 100 || v === 1000) cur = (cur || 1) * v; else cur += v; i += 2; ok = true; }
      }
    }
    // 3. Single-token with h→u substitution (fohrteen→fourteen)
    if (!ok) {
      const v = matchWithSubs(tokens[i]);
      if (v !== undefined) { found = true; noise = 0; if (v === 100 || v === 1000) cur = (cur || 1) * v; else cur += v; i += 1; ok = true; }
    }
    if (!ok) {
      if (found) {
        if (cur >= 20 && cur <= 90 && cur % 10 === 0 && noise < 2) { noise++; }
        else { r.push(cur); cur = 0; found = false; noise = 0; }
      }
      i++;
    }
  }
  if (found) r.push(cur);
  return r;
}

function extractOperands(text: string): [number, number] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const all = parseAllNumbers(tokens);
  // Try "and" split — semantically correct when the two values are on either side
  const parts = text.split(/\band\b/);
  if (parts.length >= 2) {
    const n1 = parseAllNumbers(parts[0].split(/\s+/).filter(Boolean));
    const n2 = parseAllNumbers(parts.slice(1).join(' and ').split(/\s+/).filter(Boolean));
    if (n1.length && n2.length) return [n1[n1.length - 1], n2[0]];
  }
  // Fallback: top-2-largest (handles both operands in same clause separated by "while")
  if (all.length >= 2) {
    const sorted = [...all].sort((a, b) => b - a);
    return [sorted[0], sorted[1]];
  }
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
