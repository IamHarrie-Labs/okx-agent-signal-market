/**
 * Demo: Publish a signal
 * Run: npm run demo:publish
 */
import 'dotenv/config';
import { publishSignal } from '../src/index.js';

const result = await publishSignal({
  pair: 'ETH/USDC',
  basisPoints: 200,        // predict ETH/USDC up +2%
  windowSeconds: 300,      // 5 min window (short for demo)
  stakeOKB: '0.001',
});

console.log('\n✅ Signal published!\n');
console.log(`  Signal ID:    #${result.signalId}`);
console.log(`  Pair:         ETH/USDC`);
console.log(`  Prediction:   +200bps (+2%)`);
console.log(`  Entry price:  ${result.priceAtCreation}`);
console.log(`  Settles at:   ${new Date(result.settlesAt).toISOString()}`);
console.log(`  Tx hash:      ${result.txHash}`);
console.log(`  OKX API calls: ${result.meta.onchainOsCalls}`);
console.log(`\n  Settle with: npm run demo:settle`);
