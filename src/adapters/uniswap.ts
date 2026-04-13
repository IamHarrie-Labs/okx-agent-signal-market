/**
 * Uniswap V3 price adapter.
 *
 * Primary: okx-dex-market (OnchainOS) for Uniswap V3 TWAP on X Layer.
 * Fallback: CoinGecko public API (no key required).
 *
 * This is Uniswap-as-oracle — the price feed is the truth mechanism for verdicts,
 * not used for swaps. A genuinely novel use of the protocol.
 */
import { getPairPrice, getMockPrice } from './onchainos.js';
import { isLiveMode } from '../util/env.js';
import { logger } from '../util/logger.js';

// CoinGecko coin IDs for supported pairs
const COINGECKO_IDS: Record<string, { id: string; vs: string }> = {
  'ETH/USDC': { id: 'ethereum', vs: 'usd' },
  'BTC/USDC': { id: 'bitcoin', vs: 'usd' },
  'OKB/USDC': { id: 'okb', vs: 'usd' },
};

async function fetchCoinGeckoPrice(pair: string): Promise<bigint> {
  const cfg = COINGECKO_IDS[pair];
  if (!cfg) throw new Error(`No CoinGecko mapping for pair ${pair}`);

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cfg.id}&vs_currencies=${cfg.vs}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json() as Record<string, Record<string, number>>;
  const price = data[cfg.id]?.[cfg.vs];
  if (!price) throw new Error(`CoinGecko returned no price for ${pair}`);
  logger.info(`[coingecko fallback] ${pair} = $${price}`);
  return BigInt(Math.round(price * 1e18));
}

export async function getUniswapPrice(pair: string): Promise<bigint> {
  if (!isLiveMode()) {
    const mock = getMockPrice(pair);
    logger.info(`[mock] Uniswap price for ${pair}: ${formatPrice(mock)}`);
    return mock;
  }

  // Try OnchainOS (okx-dex-market) first
  try {
    logger.info(`Fetching Uniswap V3 TWAP for ${pair} via okx-dex-market...`);
    const price = await getPairPrice(pair);
    logger.info(`Uniswap V3 price for ${pair}: ${formatPrice(price)}`);
    return price;
  } catch (err) {
    logger.warn(`okx-dex-market unreachable, falling back to CoinGecko: ${(err as Error).message}`);
    return fetchCoinGeckoPrice(pair);
  }
}

export function formatPrice(scaledPrice: bigint): string {
  const n = Number(scaledPrice) / 1e18;
  return n.toFixed(6);
}

export function priceToFloat(scaledPrice: bigint): number {
  return Number(scaledPrice) / 1e18;
}
