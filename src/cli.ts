#!/usr/bin/env node
/**
 * CLI for okx-agent-signal-market
 *
 * Usage:
 *   node --loader ts-node/esm src/cli.ts --publish --pair ETH/USDC --bps 200 --window 14400 --stake 0.01
 *   node --loader ts-node/esm src/cli.ts --settle --id 0
 *   node --loader ts-node/esm src/cli.ts --query --address 0x...
 *   node --loader ts-node/esm src/cli.ts --leaderboard
 */
import { parseArgs } from 'util';
import { publishSignal, settleSignal, queryReputation } from './index.js';
import { getAllSignals, getSignalsByAgent } from './core/signal.js';
import { buildLeaderboard } from './core/reputation.js';

const { values } = parseArgs({
  options: {
    publish:   { type: 'boolean' },
    settle:    { type: 'boolean' },
    query:     { type: 'boolean' },
    leaderboard: { type: 'boolean' },
    pair:      { type: 'string' },
    bps:       { type: 'string' },
    window:    { type: 'string' },
    stake:     { type: 'string' },
    id:        { type: 'string' },
    address:   { type: 'string' },
    payment:   { type: 'string' },
  },
  strict: false,
});

async function main() {
  if (values.publish) {
    const result = await publishSignal({
      pair: values.pair ?? 'ETH/USDC',
      basisPoints: parseInt(values.bps ?? '200'),
      windowSeconds: parseInt(values.window ?? '3600'),
      stakeOKB: values.stake ?? '0.01',
    });
    console.log('\n✅ Signal published:');
    console.log(JSON.stringify(result, null, 2));

  } else if (values.settle) {
    if (!values.id) { console.error('--id required'); process.exit(1); }
    const result = await settleSignal({ signalId: values.id });
    const icon = result.correct ? '✅' : '❌';
    console.log(`\n${icon} Signal settled:`);
    console.log(JSON.stringify(result, null, 2));

  } else if (values.query) {
    if (!values.address) { console.error('--address required'); process.exit(1); }
    const payment = values.payment
      ? JSON.parse(values.payment) as { txHash: string; from: string; amount: string }
      : undefined;
    const report = await queryReputation({ targetAddress: values.address, payment });
    console.log('\n📊 Reputation report:');
    console.log(JSON.stringify(report, null, 2));

  } else if (values.leaderboard) {
    const signals = getAllSignals().filter(s => s.status === 'settled');
    const agentMap = new Map<string, { total: number; correct: number }>();
    for (const s of signals) {
      const e = agentMap.get(s.agent) ?? { total: 0, correct: 0 };
      e.total++;
      if (s.correct) e.correct++;
      agentMap.set(s.agent, e);
    }
    const entries = Array.from(agentMap.entries()).map(([address, v]) => ({
      address,
      score: v.correct * 10 - (v.total - v.correct) * 15,
      total: v.total,
      correct: v.correct,
    }));
    const board = buildLeaderboard(entries);
    console.log('\n🏆 Leaderboard:\n');
    console.log('Rank  Address               Score  Accuracy  Signals');
    console.log('─'.repeat(55));
    for (const row of board) {
      const addr = `${row.address.slice(0, 6)}...${row.address.slice(-4)}`;
      console.log(
        `${String(row.rank).padEnd(6)}${addr.padEnd(22)}${String(row.score).padEnd(7)}${row.accuracy.padEnd(10)}${row.signals}`
      );
    }
  } else {
    console.log(`
okx-agent-signal-market CLI

Commands:
  --publish  --pair ETH/USDC --bps 200 --window 14400 --stake 0.01
  --settle   --id <signalId>
  --query    --address <0x...>
  --leaderboard
`);
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
