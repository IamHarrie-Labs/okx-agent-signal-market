import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  // OnchainOS
  OKX_API_KEY: z.string().optional(),
  OKX_SECRET_KEY: z.string().optional(),
  OKX_PASSPHRASE: z.string().optional(),

  // Wallet
  AGENT_PRIVATE_KEY: z.string().optional(),
  SIGNAL_REGISTRY_ADDRESS: z.string().optional(),

  // x402
  X402_PAYMENT_ADDRESS: z.string().optional(),

  // Moltbook
  MOLTBOOK_API_KEY: z.string().optional(),

  // Misc
  XLAYER_RPC_URL: z.string().default('https://xlayerrpc.okx.com'),
  SIGNAL_MARKET_MODE: z.enum(['auto', 'mock', 'live']).default('mock'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten());
  process.exit(1);
}

export const env = parsed.data;

export function requireLiveEnv() {
  const missing: string[] = [];
  if (!env.OKX_API_KEY) missing.push('OKX_API_KEY');
  if (!env.OKX_SECRET_KEY) missing.push('OKX_SECRET_KEY');
  if (!env.OKX_PASSPHRASE) missing.push('OKX_PASSPHRASE');
  if (!env.AGENT_PRIVATE_KEY) missing.push('AGENT_PRIVATE_KEY');
  if (!env.SIGNAL_REGISTRY_ADDRESS) missing.push('SIGNAL_REGISTRY_ADDRESS');
  if (missing.length > 0) {
    throw new Error(`Missing required env vars for live mode: ${missing.join(', ')}`);
  }
}

export function isLiveMode() {
  if (env.SIGNAL_MARKET_MODE === 'live') return true;
  if (env.SIGNAL_MARKET_MODE === 'mock') return false;
  // auto: live if all keys present
  return !!(env.OKX_API_KEY && env.AGENT_PRIVATE_KEY && env.SIGNAL_REGISTRY_ADDRESS);
}
