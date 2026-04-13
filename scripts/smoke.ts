/**
 * Smoke test — full pipeline in mock mode, no network.
 * Run: npm run smoke
 */
import 'dotenv/config';
import { publishSignal, settleSignal, queryReputation, getAllSignals } from '../src/index.js';
import { advanceMockPrice } from '../src/adapters/onchainos.js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

console.log('🔥 Smoke test starting...\n');

// 1. Publish
const pub = await publishSignal({
  pair: 'ETH/USDC', basisPoints: 150, windowSeconds: 300, stakeOKB: '0.001',
});
console.log(`✅ Published signal #${pub.signalId} at ${pub.priceAtCreation}`);

// 2. Advance mock price and fast-forward time
advanceMockPrice('ETH/USDC', 150);
const file = resolve('data/signals.json');
const sigs = JSON.parse(readFileSync(file, 'utf8'));
sigs[sigs.length - 1].settlesAt = Date.now() - 1;
writeFileSync(file, JSON.stringify(sigs, null, 2));

// 3. Settle
const settle = await settleSignal({ signalId: pub.signalId });
console.log(`✅ Settled: ${settle.correct ? 'CORRECT' : 'WRONG'} | rep ${settle.newScore}`);

// 4. Query reputation
const report = await queryReputation({ targetAddress: '0xmockagent0000000000000000000000000000001' });
console.log(`✅ Reputation: score=${report.reputationScore}, accuracy=${(report.accuracy * 100).toFixed(0)}%`);

// 5. Verify signals stored
const all = getAllSignals();
console.log(`✅ ${all.length} signal(s) in data store`);

console.log('\n✅ Smoke test passed!\n');
