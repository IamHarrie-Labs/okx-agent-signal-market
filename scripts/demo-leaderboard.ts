/**
 * Demo: Print the current leaderboard
 * Run: npm run demo:leaderboard
 */
import 'dotenv/config';
import { getAllSignals, buildLeaderboard } from '../src/index.js';

const signals = getAllSignals().filter(s => s.status === 'settled');

if (signals.length === 0) {
  console.log('\nNo settled signals yet. Run the publish + settle demos first.');
  process.exit(0);
}

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

console.log('\n🏆 Signal Market Leaderboard\n');
console.log('Rank  Address               Score  Accuracy  Signals');
console.log('─'.repeat(55));
for (const row of board) {
  const addr = `${row.address.slice(0, 6)}...${row.address.slice(-4)}`;
  console.log(
    `${String(row.rank).padEnd(6)}${addr.padEnd(22)}${String(row.score).padEnd(7)}${row.accuracy.padEnd(10)}${row.signals}`
  );
}
console.log('');
