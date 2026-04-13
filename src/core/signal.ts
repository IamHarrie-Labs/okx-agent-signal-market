/**
 * Signal lifecycle: publish → pending → settle
 * Handles both live (on-chain) and mock modes.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseEther } from 'viem';
import type { PublishInput, SettleInput, StoredSignal, PublishResult, SettleResult } from './schema.js';
import { computeVerdict, scalePrice } from './verdict.js';
import { scoreDelta } from './reputation.js';
import { getUniswapPrice, formatPrice } from '../adapters/uniswap.js';
import { getPublicClient, getWalletClient, parseOKB } from '../adapters/xlayer.js';
import { SIGNAL_REGISTRY_ABI } from '../contracts/abis.js';
import { env, isLiveMode } from '../util/env.js';
import { logger, getOnchainOsCallCount, resetOnchainOsCallCount } from '../util/logger.js';
import { postSettlementToMoltbook } from '../adapters/moltbook.js';
import { advanceMockPrice } from '../adapters/onchainos.js';

const DATA_FILE = resolve('data/signals.json');

function loadSignals(): StoredSignal[] {
  if (!existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8')) as StoredSignal[];
  } catch {
    return [];
  }
}

function saveSignals(signals: StoredSignal[]) {
  writeFileSync(DATA_FILE, JSON.stringify(signals, null, 2));
}

// ── Mock state ──────────────────────────────────────────────────────────
let _mockNextId = 0;
let _mockReputation: Record<string, number> = {};

export function resetMockState() {
  _mockNextId = 0;
  _mockReputation = {};
  saveSignals([]);
}

// ── Publish ─────────────────────────────────────────────────────────────

export async function publishSignal(input: PublishInput): Promise<PublishResult> {
  resetOnchainOsCallCount();

  const priceAtCreation = await getUniswapPrice(input.pair);
  const now = Date.now();
  const settlesAt = now + input.windowSeconds * 1000;

  let txHash: string;
  let signalId: string;

  if (isLiveMode()) {
    const { client, account } = getWalletClient();
    const registry = env.SIGNAL_REGISTRY_ADDRESS as `0x${string}`;
    const stakeWei = parseOKB(input.stakeOKB);

    const hash = await client.writeContract({
      address: registry,
      abi: SIGNAL_REGISTRY_ABI,
      functionName: 'publishSignal',
      args: [input.pair, input.basisPoints, BigInt(input.windowSeconds), priceAtCreation],
      value: stakeWei,
    });

    const publicClient = getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    txHash = hash;

    // Parse signalId from event
    const event = receipt.logs.find(l => l.topics[0]); // SignalPublished
    signalId = event ? parseInt(event.topics[1] ?? '0x0', 16).toString() : String(_mockNextId++);
  } else {
    txHash = `0xmock_publish_${Date.now().toString(16)}`;
    signalId = String(_mockNextId++);
  }

  const stored: StoredSignal = {
    id: signalId,
    agent: isLiveMode() ? getWalletClient().account.address : '0xmockagent0000000000000000000000000000001',
    pair: input.pair,
    basisPoints: input.basisPoints,
    windowSeconds: input.windowSeconds,
    stakeOKBWei: parseEther(input.stakeOKB).toString(),
    createdAt: now,
    settlesAt,
    priceAtCreation: priceAtCreation.toString(),
    txHash,
    status: 'pending',
  };

  const signals = loadSignals();
  signals.push(stored);
  saveSignals(signals);

  logger.info(`Published signal #${signalId}`, { pair: input.pair, basisPoints: input.basisPoints });

  return {
    signalId,
    txHash,
    priceAtCreation: formatPrice(priceAtCreation),
    settlesAt,
    meta: { onchainOsCalls: getOnchainOsCallCount() },
  };
}

// ── Settle ───────────────────────────────────────────────────────────────

export async function settleSignal(input: SettleInput): Promise<SettleResult> {
  resetOnchainOsCallCount();

  const signals = loadSignals();
  const signal = signals.find(s => s.id === input.signalId);
  if (!signal) throw new Error(`Signal #${input.signalId} not found`);
  if (signal.status === 'settled') throw new Error(`Signal #${input.signalId} already settled`);

  const now = Date.now();
  if (now < signal.settlesAt) {
    const remaining = Math.ceil((signal.settlesAt - now) / 1000);
    throw new Error(`Signal #${input.signalId} not yet ready — ${remaining}s remaining`);
  }

  const priceAtSettlement = await getUniswapPrice(signal.pair);

  const verdict = computeVerdict({
    predictedBps: signal.basisPoints,
    priceAtCreation: BigInt(signal.priceAtCreation),
    priceAtSettlement,
  });

  let txHash: string;
  let oldScore: number;

  if (isLiveMode()) {
    const { client } = getWalletClient();
    const registry = env.SIGNAL_REGISTRY_ADDRESS as `0x${string}`;

    const hash = await client.writeContract({
      address: registry,
      abi: SIGNAL_REGISTRY_ABI,
      functionName: 'settleSignal',
      args: [BigInt(signal.id), verdict.correct],
    });

    const publicClient = getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash });
    txHash = hash;

    const repRaw = await publicClient.readContract({
      address: registry,
      abi: SIGNAL_REGISTRY_ABI,
      functionName: 'reputation',
      args: [signal.agent as `0x${string}`],
    }) as bigint;
    oldScore = Number(repRaw) - scoreDelta(verdict.correct);
  } else {
    txHash = `0xmock_settle_${Date.now().toString(16)}`;
    oldScore = _mockReputation[signal.agent] ?? 0;
    _mockReputation[signal.agent] = oldScore + scoreDelta(verdict.correct);
  }

  const newScore = oldScore + scoreDelta(verdict.correct);

  // Update stored signal
  signal.status = 'settled';
  signal.correct = verdict.correct;
  signal.priceAtSettlement = priceAtSettlement.toString();
  signal.settleTxHash = txHash;
  signal.settledAt = now;
  saveSignals(signals);

  // Auto-post to Moltbook
  await postSettlementToMoltbook(signal, oldScore, newScore);

  logger.info(`Settled signal #${signal.id}: ${verdict.correct ? 'CORRECT' : 'WRONG'} — ${verdict.reason}`);

  return {
    signalId: signal.id,
    correct: verdict.correct,
    reputationDelta: scoreDelta(verdict.correct),
    newScore,
    priceAtCreation: formatPrice(BigInt(signal.priceAtCreation)),
    priceAtSettlement: formatPrice(priceAtSettlement),
    actualBps: verdict.actualBps,
    txHash,
    meta: { onchainOsCalls: getOnchainOsCallCount() },
  };
}

// ── Query helpers ────────────────────────────────────────────────────────

export function getAllSignals(): StoredSignal[] {
  return loadSignals();
}

export function getSignalsByAgent(address: string): StoredSignal[] {
  return loadSignals().filter(s => s.agent.toLowerCase() === address.toLowerCase());
}

export function getMockReputation(address: string): number {
  return _mockReputation[address] ?? 0;
}

export async function getOnChainReputation(address: string): Promise<number> {
  if (!isLiveMode()) return getMockReputation(address);
  const client = getPublicClient();
  const registry = env.SIGNAL_REGISTRY_ADDRESS as `0x${string}`;
  const rep = await client.readContract({
    address: registry,
    abi: SIGNAL_REGISTRY_ABI,
    functionName: 'reputation',
    args: [address as `0x${string}`],
  }) as bigint;
  return Number(rep);
}
