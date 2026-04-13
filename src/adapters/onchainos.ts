import { env } from '../util/env.js';
import { logger } from '../util/logger.js';
import * as crypto from 'crypto';

const BASE_URL = 'https://www.okx.com/api/v5/waas';

function buildHeaders(method: string, path: string, body: string): Record<string, string> {
  const ts = new Date().toISOString();
  const msg = ts + method.toUpperCase() + path + body;
  const sig = crypto.createHmac('sha256', env.OKX_SECRET_KEY ?? '').update(msg).digest('base64');
  return {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': env.OKX_API_KEY ?? '',
    'OK-ACCESS-SIGN': sig,
    'OK-ACCESS-TIMESTAMP': ts,
    'OK-ACCESS-PASSPHRASE': env.OKX_PASSPHRASE ?? '',
  };
}

async function onchainOsRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const fullPath = `/api/v5/waas${path}`;
  const bodyStr = body ? JSON.stringify(body) : '';
  const headers = buildHeaders(method, fullPath, bodyStr);
  const url = `https://www.okx.com${fullPath}`;

  const start = Date.now();
  const res = await fetch(url, {
    method,
    headers,
    ...(bodyStr ? { body: bodyStr } : {}),
  });
  logger.onchainOs(path, res.status, Date.now() - start);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OnchainOS ${path} failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Get current price for a pair via okx-dex-market. Returns price scaled 1e18. */
export async function getPairPrice(pair: string): Promise<bigint> {
  // pair: "ETH/USDC" → base "ETH", quote "USDC"
  const [base, quote] = pair.split('/');
  const data = await onchainOsRequest<{ data: Array<{ lastPr: string }> }>(
    'GET',
    `/dex/aggregator/quote?fromTokenAddress=${base}&toTokenAddress=${quote}&amount=1000000000000000000&chainIndex=196`,
  );
  const price = parseFloat(data.data[0]?.lastPr ?? '0');
  return BigInt(Math.round(price * 1e18));
}

/** Check OKB balance for an address. */
export async function getOKBBalance(address: string): Promise<bigint> {
  const data = await onchainOsRequest<{ data: Array<{ balance: string }> }>(
    'GET',
    `/asset/wallet-token-detail?address=${address}&chainIndex=196`,
  );
  const balStr = data.data[0]?.balance ?? '0';
  return BigInt(Math.round(parseFloat(balStr) * 1e18));
}

/** Simulate a transaction via okx-onchain-gateway. */
export async function simulateTx(params: {
  from: string;
  to: string;
  data: string;
  value: string;
}) {
  return onchainOsRequest<{ data: { success: boolean; gasUsed: string } }>(
    'POST',
    '/dex/pre-transaction',
    { ...params, chainIndex: '196' },
  );
}

/** Broadcast a signed transaction. */
export async function broadcastTx(signedTx: string) {
  return onchainOsRequest<{ data: { orderId: string } }>(
    'POST',
    '/dex/send-transaction',
    { signedTx, chainIndex: '196' },
  );
}

// ── Mock implementations (used in mock mode) ──────────────────────────

export const MOCK_PRICES: Record<string, number> = {
  'ETH/USDC': 3200.00,
  'BTC/USDC': 68000.00,
  'OKB/USDC': 45.00,
};

let mockPriceOffset = 0;

export function advanceMockPrice(pair: string, bps: number) {
  MOCK_PRICES[pair] = (MOCK_PRICES[pair] ?? 100) * (1 + bps / 10000);
}

export function getMockPrice(pair: string): bigint {
  const price = MOCK_PRICES[pair] ?? 100;
  return BigInt(Math.round(price * 1e18));
}
