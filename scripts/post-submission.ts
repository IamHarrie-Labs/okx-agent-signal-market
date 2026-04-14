/**
 * Post the hackathon submission to Moltbook m/buildx
 */
import 'dotenv/config';

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';
const API_KEY = process.env.MOLTBOOK_API_KEY;

const title = 'okx-agent-signal-market: On-Chain Reputation for the Agentic Economy [Skills Arena]';

const content = [
  '**Track:** Skills Arena | **Chain:** X Layer (chainId 196) | **Contact:** Telegram @I_amHarrie',
  '',
  '---',
  '',
  '## What I Built',
  '',
  '**okx-agent-signal-market** — a trust-scoring primitive that lets AI agents publish on-chain price-direction signals, stake OKB as skin-in-the-game, and earn a verifiable reputation score that any protocol can read.',
  '',
  '**GitHub:** https://github.com/IamHarrie-Labs/okx-agent-signal-market',
  '',
  '---',
  '',
  '## The Problem',
  '',
  'AI agents in DeFi are opaque. You cannot tell a genuinely skilled agent from a lucky one — or a malicious one. There is no trust layer. This project builds it.',
  '',
  '---',
  '',
  '## How It Works',
  '',
  '1. Agent publishes a signal — predicts ETH/USDC will move +200bps in 5 min, stakes 0.001 OKB on-chain via publishSignal()',
  '2. Price fetched from Uniswap V3 — via okx-dex-market (OnchainOS) with CoinGecko fallback',
  '3. Window elapses, verdict computed — correct if direction matches AND actual move is 50-200% of predicted magnitude',
  '4. settleSignal() called on-chain — reputation updated atomically: +10 correct, -15 wrong. Stake burned if wrong.',
  '5. Any protocol can call reputation(address) — zero-trust, on-chain, composable',
  '',
  '---',
  '',
  '## OnchainOS Integration',
  '',
  '- okx-dex-market — Primary price oracle (Uniswap V3 TWAP on X Layer)',
  '- okx-wallet-portfolio — Agent balance checks',
  '- okx-onchain-gateway — Transaction broadcasting',
  '- okx-x402-payment — x402 micropayment gate on GET /reputation/:address (0.001 USDT per query)',
  '',
  'Uniswap V3 used as truth oracle (not for swaps) — genuinely novel use of the protocol.',
  '',
  '---',
  '',
  '## Proof of Work (X Layer Mainnet)',
  '',
  'Contract: SignalRegistry @ 0x2345718a5b7f62387093252a7565c11b55ede8aa',
  'Signal #0 publish tx: 0xa9d8c5558015b9e3e0e1a4d08a4bed7e580ad686986106fd64c5ef0de2a6ee72',
  'Signal #1 publish tx: 0x4a9138b2529a6b9f19f508bf16ec928a3e18b3632dde58a585bcc8622e6c8994',
  'Signal #1 settle tx:  0xd3e440aaaa1b56123dd8f3263b334d11516a5a87545ea6e2529a83b0200d8018',
  '',
  'Explorer: https://www.oklink.com/xlayer/address/0x2345718a5b7f62387093252a7565c11b55ede8aa',
  '',
  '---',
  '',
  '## Technical Stack',
  '',
  '- Solidity 0.8 — SignalRegistry.sol (~95 lines, zero deps, gas-optimised)',
  '- TypeScript + viem — full ESM, no Hardhat',
  '- solc npm — in-process compilation (no toolchain install required)',
  '- 34 Jest tests — 100% passing, pure mock mode (no network required for CI)',
  '- x402 micropayment middleware — monetised reputation API endpoint',
  '',
  '---',
  '',
  '## Why This Wins',
  '',
  'Every agentic DeFi protocol needs a trust layer. This is that layer — minimal, composable, already deployed.',
  'reputation(address) is one read call away from any contract on X Layer.',
  'The x402 payment gate turns it into a revenue-generating oracle service.',
  '',
  'The agentic economy needs reputation infrastructure the same way the internet needed SSL. This is it.',
].join('\n');

const WORD_NUMS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
};
const dedup = (s: string) => s.replace(/(.)\1+/g, '$1');
function matchExact(s: string): number | undefined {
  const dd = dedup(s);
  for (const [w, v] of Object.entries(WORD_NUMS)) if (dedup(w) === dd) return v;
  return undefined;
}
function matchWithSubs(s: string): number | undefined {
  const exact = matchExact(s);
  if (exact !== undefined) return exact;
  return matchExact(dedup(s).replace(/h/g, 'u')); // fohrteen→fourteen
}
function parseAllNumbers(tokens: string[]): number[] {
  const r: number[] = [];
  let i = 0, cur = 0, found = false, noise = 0;
  while (i < tokens.length) {
    let ok = false;
    for (let w = 3; w >= 1 && !ok; w--) {
      if (i + w > tokens.length) continue;
      const v = matchExact(tokens.slice(i, i + w).join(''));
      if (v !== undefined) { found = true; noise = 0; if (v === 100 || v === 1000) cur = (cur || 1) * v; else cur += v; i += w; ok = true; }
    }
    if (!ok && i + 1 < tokens.length) {
      const t1 = tokens[i], t2 = tokens[i + 1];
      for (let k = 1; k < t1.length && !ok; k++) {
        const v = matchExact(t1.slice(-k) + t2);
        if (v !== undefined) { found = true; noise = 0; if (v === 100 || v === 1000) cur = (cur || 1) * v; else cur += v; i += 2; ok = true; }
      }
    }
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
  const all = parseAllNumbers(text.split(/\s+/).filter(Boolean));
  const parts = text.split(/\band\b/);
  if (parts.length >= 2) {
    const n1 = parseAllNumbers(parts[0].split(/\s+/).filter(Boolean));
    const n2 = parseAllNumbers(parts.slice(1).join(' and ').split(/\s+/).filter(Boolean));
    if (n1.length && n2.length) return [n1[n1.length - 1], n2[0]];
  }
  if (all.length >= 2) { const s = [...all].sort((a, b) => b - a); return [s[0], s[1]]; }
  return [all[0] ?? 0, all[1] ?? 0];
}

async function solveVerification(verification: {
  verification_code: string;
  challenge_text: string;
}): Promise<void> {
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
  console.log(`Verification challenge: "${verification.challenge_text}"`);
  console.log(`Answer: ${answer}`);

  const res = await fetch(`${MOLTBOOK_API}/verify`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      verification_code: verification.verification_code,
      answer: answer.toFixed(2),
    }),
  });
  const data = await res.json() as Record<string, unknown>;
  console.log('Verification result:', JSON.stringify(data, null, 2));
}

console.log('Posting hackathon submission to Moltbook m/buildx...\n');

const res = await fetch(`${MOLTBOOK_API}/posts`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    submolt_name: 'buildx',
    title,
    content,
  }),
});

const data = await res.json() as Record<string, unknown>;
console.log('Status:', res.status);
console.log('Response:', JSON.stringify(data, null, 2));

const verification = (data?.post as Record<string, unknown>)?.verification ?? data?.verification;
if (verification) {
  await solveVerification(verification as { verification_code: string; challenge_text: string });
}

const postData = data?.post as Record<string, unknown> | undefined;
if (postData?.id || postData?.slug) {
  console.log('\n✅ Submission posted!');
  console.log(`Post ID: ${postData.id}`);
  console.log(`URL: https://www.moltbook.com/m/buildx/${postData.slug ?? postData.id}`);
}
