/**
 * Demo: Settle the most recent pending signal
 * Run: npm run demo:settle
 */
import 'dotenv/config';
import { getAllSignals } from '../src/index.js';
import { settleSignal } from '../src/index.js';
import { advanceMockPrice } from '../src/adapters/onchainos.js';

const pending = getAllSignals()
  .filter(s => s.status === 'pending')
  .sort((a, b) => b.createdAt - a.createdAt);

if (pending.length === 0) {
  console.log('No pending signals. Run npm run demo:publish first.');
  process.exit(0);
}

const signal = pending[0];
console.log(`\nSettling signal #${signal.id} (${signal.pair} ${signal.basisPoints > 0 ? '+' : ''}${signal.basisPoints}bps)...`);

// In mock mode: advance price by the predicted amount so prediction is correct
advanceMockPrice(signal.pair, signal.basisPoints);
console.log(`[mock] Advanced ${signal.pair} price by ${signal.basisPoints}bps`);

// Force settlesAt to now (mock demo)
const { readFileSync, writeFileSync } = await import('fs');
const { resolve } = await import('path');
const file = resolve('data/signals.json');
const signals = JSON.parse(readFileSync(file, 'utf8'));
const idx = signals.findIndex((s: { id: string }) => s.id === signal.id);
signals[idx].settlesAt = Date.now() - 1000;
writeFileSync(file, JSON.stringify(signals, null, 2));

const result = await settleSignal({ signalId: signal.id });

const icon = result.correct ? '✅' : '❌';
console.log(`\n${icon} Settlement complete!\n`);
console.log(`  Signal ID:        #${result.signalId}`);
console.log(`  Verdict:          ${result.correct ? 'CORRECT' : 'WRONG'}`);
console.log(`  Entry price:      ${result.priceAtCreation}`);
console.log(`  Settlement price: ${result.priceAtSettlement}`);
console.log(`  Actual move:      ${result.actualBps.toFixed(1)}bps`);
console.log(`  Rep delta:        ${result.reputationDelta > 0 ? '+' : ''}${result.reputationDelta}`);
console.log(`  New score:        ${result.newScore}`);
console.log(`  Tx hash:          ${result.txHash}`);
console.log(`  OKX API calls:    ${result.meta.onchainOsCalls}`);
