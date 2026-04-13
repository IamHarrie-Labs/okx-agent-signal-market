import { createPublicClient, createWalletClient, http, defineChain, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { env } from '../util/env.js';

export const xlayer = defineChain({
  id: 196,
  name: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: {
    default: { http: [env.XLAYER_RPC_URL] },
  },
  blockExplorers: {
    default: { name: 'OKLink', url: 'https://www.oklink.com/xlayer' },
  },
});

export function getPublicClient() {
  return createPublicClient({ chain: xlayer, transport: http(env.XLAYER_RPC_URL) });
}

export function getWalletClient() {
  if (!env.AGENT_PRIVATE_KEY) throw new Error('AGENT_PRIVATE_KEY not set');
  const account = privateKeyToAccount(env.AGENT_PRIVATE_KEY as `0x${string}`);
  return {
    client: createWalletClient({ account, chain: xlayer, transport: http(env.XLAYER_RPC_URL) }),
    account,
  };
}

export function explorerTxUrl(txHash: string) {
  return `https://www.oklink.com/xlayer/tx/${txHash}`;
}

export function parseOKB(amount: string): bigint {
  return parseEther(amount);
}
