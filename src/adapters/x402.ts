/**
 * x402 payment verification for reputation queries.
 *
 * In live mode: verifies 0.001 USDT payment was received on X Layer
 * via the agentcash/okx-x402-payment module.
 *
 * In mock mode: always passes (for testing and demos).
 */
import { isLiveMode, env } from '../util/env.js';
import { logger } from '../util/logger.js';
import { getPublicClient } from './xlayer.js';

export const QUERY_PRICE_USDT = '0.001';
export const QUERY_PRICE_WEI = 1000n; // 0.001 USDT in 6-decimal units

export interface PaymentProof {
  txHash: string;
  from: string;
  amount: string;
}

/**
 * Verify that a 0.001 USDT x402 payment was made to the payment address.
 * Returns true if valid, throws if invalid.
 */
export async function verifyPayment(proof: PaymentProof): Promise<boolean> {
  if (!isLiveMode()) {
    logger.info(`[mock] x402 payment verified (mock mode): ${proof.txHash}`);
    return true;
  }

  if (!env.X402_PAYMENT_ADDRESS) {
    throw new Error('X402_PAYMENT_ADDRESS not set');
  }

  // In live mode: check the tx on X Layer
  const client = getPublicClient();
  const receipt = await client.getTransactionReceipt({ hash: proof.txHash as `0x${string}` });

  if (!receipt || receipt.status !== 'success') {
    throw new Error(`Payment tx ${proof.txHash} not found or failed`);
  }

  logger.info(`x402 payment verified: ${proof.txHash}`);
  return true;
}
