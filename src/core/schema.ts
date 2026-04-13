import { z } from 'zod';

export const PairSchema = z.string().regex(/^[A-Z]+\/[A-Z]+$/, 'Pair must be like ETH/USDC');

export const PublishInputSchema = z.object({
  pair: PairSchema,
  basisPoints: z.number().int().min(-10000).max(10000).refine(v => v !== 0),
  windowSeconds: z.number().int().min(300),
  stakeOKB: z.string().regex(/^\d+(\.\d+)?$/, 'stakeOKB must be a decimal string'),
});

export const SettleInputSchema = z.object({
  signalId: z.string(),
});

export const QueryReputationInputSchema = z.object({
  targetAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export type PublishInput = z.infer<typeof PublishInputSchema>;
export type SettleInput = z.infer<typeof SettleInputSchema>;
export type QueryReputationInput = z.infer<typeof QueryReputationInputSchema>;

export interface StoredSignal {
  id: string;
  agent: string;
  pair: string;
  basisPoints: number;
  windowSeconds: number;
  stakeOKBWei: string;
  createdAt: number;         // unix ms
  settlesAt: number;         // unix ms
  priceAtCreation: string;   // scaled string
  txHash: string;
  status: 'pending' | 'settled';
  correct?: boolean;
  priceAtSettlement?: string;
  settleTxHash?: string;
  settledAt?: number;
}

export interface ReputationReport {
  address: string;
  reputationScore: number;
  totalSignals: number;
  correctSignals: number;
  accuracy: number;
  lastActive: number | null;
  recentSignals: StoredSignal[];
}

export interface PublishResult {
  signalId: string;
  txHash: string;
  priceAtCreation: string;
  settlesAt: number;
  meta: { onchainOsCalls: number };
}

export interface SettleResult {
  signalId: string;
  correct: boolean;
  reputationDelta: number;
  newScore: number;
  priceAtCreation: string;
  priceAtSettlement: string;
  actualBps: number;
  txHash: string;
  meta: { onchainOsCalls: number };
}
